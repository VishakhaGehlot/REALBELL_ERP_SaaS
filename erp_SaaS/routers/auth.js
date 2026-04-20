const router = require('express').Router()
const authTable = require('../models/auth')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const logincheck = require('../middleware/logincheck')
const { normalizeRole, requireAuth } = require('../middleware/roleAuth')
const queryTable = require('../models/query')
const CRM = require('../models/CRM')
const Employee = require('../models/HRM/Employees')
const Product = require('../models/product')
const PosOrder = require('../models/PosOrder')
const userPlan = require('../models/userPlan')
const BusinessLead = require('../models/BusinessLead')
const DealPipeline = require('../models/DealPipeline')
const Lead = require('../models/CRM/Lead')
const Deal = require('../models/CRM/Deal')
const ProjectBoard = require('../models/ProjectBoard')
const AccountingEntry = require('../models/AccountingEntry')
const EventSchedule = require('../models/EventSchedule')
const SupportDeskRecord = require('../models/SupportDeskRecord')
const SmsCampaign = require('../models/SmsCampaign')
const SentMessage = require('../models/SentMessage')
const ZoomMeeting = require('../models/ZoomMeeting')
const SalesTarget = require('../models/SalesTarget')
const SalesMember = require('../models/SalesMember')
const faqTable = require('../models/faq')
const featureTable = require('../models/feature')
const solutionTable = require('../models/solution')
const { getPermissionsForRole, MODULE_LABELS } = require('../middleware/permissionAuth')

// Helper function to get user data from session
async function getUserData(email) {
    try {
        const user = await authTable.findOne({ email: email })
        if (user) {
            return {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            }
        }
        return null
    } catch (error) {
        console.error('Error getting user data:', error)
        return null
    }
}

function hasAnyPermission(permissions, moduleKey) {
    const modulePermissions = permissions && permissions[moduleKey]
    if (!modulePermissions || typeof modulePermissions !== 'object') return false
    return Object.values(modulePermissions).some(Boolean)
}

function sumBy(items, key) {
    return items.reduce((sum, item) => sum + Number(item && item[key] ? item[key] : 0), 0)
}

function buildRecentItem(title, subtitle, status, createdAt, link) {
    return { title, subtitle, status, createdAt, link }
}

async function buildCompanyDashboard(user, permissions) {
    const userEmail = String(user.email || '').toLowerCase()
    const moduleCards = []
    const recentActivity = []

    if (hasAnyPermission(permissions, 'subscription')) {
        const subscriptionFilter = {
            $or: [
                { email: user.email },
                { businessEmail: user.email }
            ]
        }
        const [plans, activePlans, paidPlans, latestPlan] = await Promise.all([
            userPlan.countDocuments(subscriptionFilter),
            userPlan.countDocuments({ ...subscriptionFilter, subscriptionStatus: 'Active' }),
            userPlan.countDocuments({ ...subscriptionFilter, paymentStatus: 'Paid' }),
            userPlan.findOne(subscriptionFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'subscription',
            label: MODULE_LABELS.subscription,
            icon: 'bi-credit-card-2-front',
            total: plans,
            primaryText: `${activePlans} active plans`,
            secondaryText: `${paidPlans} paid subscriptions`,
            alertCount: Math.max(plans - activePlans, 0),
            link: '/payment-history'
        })

        if (latestPlan) {
            recentActivity.push(buildRecentItem(
                `Plan updated: ${latestPlan.planName || 'Subscription'}`,
                `${latestPlan.businessName || latestPlan.name || user.email}`,
                latestPlan.subscriptionStatus || latestPlan.paymentStatus || 'Pending',
                latestPlan.updatedAt || latestPlan.createdAt,
                '/payment-history'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'crm')) {
        const crmFilter = { ownerEmail: userEmail }
        const [contacts, pendingContacts, activeContacts, latestContact] = await Promise.all([
            CRM.countDocuments(crmFilter),
            CRM.countDocuments({ ...crmFilter, status: 'Pending' }),
            CRM.countDocuments({ ...crmFilter, status: 'Active' }),
            CRM.findOne(crmFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'crm',
            label: MODULE_LABELS.crm,
            icon: 'bi-people-fill',
            total: contacts,
            primaryText: `${activeContacts} active contacts`,
            secondaryText: `${pendingContacts} pending follow-ups`,
            alertCount: pendingContacts,
            link: '/addcontacttable'
        })

        if (latestContact) {
            recentActivity.push(buildRecentItem(
                `CRM contact: ${latestContact.name || 'Contact'}`,
                latestContact.email || latestContact.phoneno || 'Recent contact added',
                latestContact.status || 'Pending',
                latestContact.createdAt,
                '/addcontacttable'
            ))
        }
    }

    // Lead Management Stats
    if (hasAnyPermission(permissions, 'leadManagement')) {
        const leadFilter = { 
            $or: [
                { createdBy: user._id },
                { assignedTo: user._id }
            ]
        }
        const [totalLeads, newLeads, contactedLeads, qualifiedLeads, convertedLeads, latestLead] = await Promise.all([
            Lead.countDocuments(leadFilter),
            Lead.countDocuments({ ...leadFilter, status: 'New' }),
            Lead.countDocuments({ ...leadFilter, status: 'Contacted' }),
            Lead.countDocuments({ ...leadFilter, status: 'Qualified' }),
            Lead.countDocuments({ ...leadFilter, status: 'Converted' }),
            Lead.findOne(leadFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'leadManagement',
            label: 'CRM Leads',
            icon: 'bi-funnel-fill',
            total: totalLeads,
            primaryText: `${qualifiedLeads} qualified leads`,
            secondaryText: `${newLeads} new, ${contactedLeads} contacted`,
            alertCount: newLeads + contactedLeads,
            link: '/crm/leads'
        })

        if (latestLead) {
            recentActivity.push(buildRecentItem(
                `Lead: ${latestLead.name || 'New Lead'}`,
                latestLead.email || latestLead.phone || 'Lead captured',
                latestLead.status || 'New',
                latestLead.createdAt,
                '/crm/leads'
            ))
        }
    }

    // Deal Pipeline Stats
    if (hasAnyPermission(permissions, 'dealManagement')) {
        const dealFilter = { 
            $or: [
                { createdBy: user._id },
                { owner: user._id }
            ]
        }
        const [totalDeals, discoveryDeals, proposalDeals, negotiationDeals, wonDeals, lostDeals, dealsValue, latestDeal] = await Promise.all([
            Deal.countDocuments(dealFilter),
            Deal.countDocuments({ ...dealFilter, stage: 'Discovery' }),
            Deal.countDocuments({ ...dealFilter, stage: 'Proposal' }),
            Deal.countDocuments({ ...dealFilter, stage: 'Negotiation' }),
            Deal.countDocuments({ ...dealFilter, stage: 'Closed Won' }),
            Deal.countDocuments({ ...dealFilter, stage: 'Closed Lost' }),
            Deal.aggregate([
                { $match: { ...dealFilter, stage: { $nin: ['Closed Won', 'Closed Lost'] } } },
                { $group: { _id: null, total: { $sum: '$expectedRevenue' } } }
            ]),
            Deal.findOne(dealFilter).sort({ createdAt: -1 }).lean()
        ])

        const pipelineValue = dealsValue[0]?.total || 0
        const activeDeals = discoveryDeals + proposalDeals + negotiationDeals

        moduleCards.push({
            moduleKey: 'dealManagement',
            label: 'CRM Deals',
            icon: 'bi-trophy',
            total: totalDeals,
            primaryText: `₹${Number(pipelineValue).toLocaleString('en-IN')} pipeline`,
            secondaryText: `${activeDeals} active, ${wonDeals} won`,
            alertCount: negotiationDeals + proposalDeals,
            link: '/crm/deals'
        })

        if (latestDeal) {
            recentActivity.push(buildRecentItem(
                `Deal: ${latestDeal.title || 'New Deal'}`,
                `Value: ₹${Number(latestDeal.value || 0).toLocaleString('en-IN')}`,
                latestDeal.stage || 'Discovery',
                latestDeal.createdAt,
                '/crm/deals'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'hrm')) {
        const employeeFilter = {
            $or: [
                { createdByEmail: userEmail },
                { email: user.email }
            ]
        }
        const [employees, activeEmployees, leaveEmployees, latestEmployee] = await Promise.all([
            Employee.countDocuments(employeeFilter),
            Employee.countDocuments({ ...employeeFilter, status: 'Active' }),
            Employee.countDocuments({ ...employeeFilter, status: 'On Leave' }),
            Employee.findOne(employeeFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'hrm',
            label: MODULE_LABELS.hrm,
            icon: 'bi-person-badge',
            total: employees,
            primaryText: `${activeEmployees} active employees`,
            secondaryText: `${leaveEmployees} on leave`,
            alertCount: leaveEmployees,
            link: '/employees'
        })

        if (latestEmployee) {
            recentActivity.push(buildRecentItem(
                `Employee onboarded: ${latestEmployee.name || 'Team member'}`,
                `${latestEmployee.department || '-'} / ${latestEmployee.position || '-'}`,
                latestEmployee.status || 'Active',
                latestEmployee.createdAt,
                '/employees'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'queryManagement')) {
        const [queries, repliedQueries, latestQuery] = await Promise.all([
            queryTable.countDocuments(),
            queryTable.countDocuments({ replied: true }),
            queryTable.findOne().sort({ createdDate: -1 }).lean()
        ])
        const pendingQueries = Math.max(queries - repliedQueries, 0)

        moduleCards.push({
            moduleKey: 'queryManagement',
            label: MODULE_LABELS.queryManagement,
            icon: 'bi-chat-dots',
            total: queries,
            primaryText: `${repliedQueries} replied`,
            secondaryText: `${pendingQueries} waiting response`,
            alertCount: pendingQueries,
            link: '/querytable'
        })

        if (latestQuery) {
            recentActivity.push(buildRecentItem(
                `New query from ${(latestQuery.firstName || '')} ${(latestQuery.lastName || '')}`.trim() || 'New query',
                (latestQuery.message || '').slice(0, 80) || latestQuery.email || 'Customer query received',
                latestQuery.replied ? 'Replied' : 'Pending',
                latestQuery.createdDate,
                '/querytable'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'frontendManagement')) {
        const [faqCount, featureCount, solutionCount] = await Promise.all([
            faqTable.countDocuments(),
            featureTable.countDocuments(),
            solutionTable.countDocuments()
        ])
        const totalContent = faqCount + featureCount + solutionCount

        moduleCards.push({
            moduleKey: 'frontendManagement',
            label: MODULE_LABELS.frontendManagement,
            icon: 'bi-window',
            total: totalContent,
            primaryText: `${faqCount} FAQs published`,
            secondaryText: `${featureCount + solutionCount} content blocks`,
            alertCount: 0,
            link: '/faqtable'
        })
    }

    if (hasAnyPermission(permissions, 'productManagement')) {
        const [products, activeProducts, lowStockProducts] = await Promise.all([
            Product.countDocuments(),
            Product.countDocuments({ activeStatus: 'Active' }),
            Product.countDocuments({ status: { $in: ['Low Stock', 'Out of Stock', 'Limited Stock'] } })
        ])

        moduleCards.push({
            moduleKey: 'productManagement',
            label: MODULE_LABELS.productManagement,
            icon: 'bi-box-seam',
            total: products,
            primaryText: `${activeProducts} active products`,
            secondaryText: `${lowStockProducts} need stock attention`,
            alertCount: lowStockProducts,
            link: '/producttable'
        })
    }

    if (hasAnyPermission(permissions, 'accounting')) {
        const accountingFilter = { createdBy: user.email }
        const [entries, pendingEntries, postedEntries, accountingTotals] = await Promise.all([
            AccountingEntry.countDocuments(accountingFilter),
            AccountingEntry.countDocuments({ ...accountingFilter, status: 'Pending' }),
            AccountingEntry.countDocuments({ ...accountingFilter, status: { $in: ['Posted', 'Paid'] } }),
            AccountingEntry.aggregate([
                { $match: accountingFilter },
                { $group: { _id: null, amount: { $sum: '$amount' } } }
            ])
        ])
        const totalAmount = accountingTotals[0] ? Number(accountingTotals[0].amount || 0) : 0

        moduleCards.push({
            moduleKey: 'accounting',
            label: MODULE_LABELS.accounting,
            icon: 'bi-calculator',
            total: entries,
            primaryText: `${postedEntries} posted or paid entries`,
            secondaryText: `Rs ${totalAmount.toLocaleString('en-IN')} tracked`,
            alertCount: pendingEntries,
            link: '/ledger'
        })
    }

    if (hasAnyPermission(permissions, 'pos')) {
        const posFilter = { createdBy: user.email }
        const [orders, pendingOrders, paidOrders, orderTotals, latestOrder] = await Promise.all([
            PosOrder.countDocuments(posFilter),
            PosOrder.countDocuments({ ...posFilter, paymentStatus: { $in: ['Pending', 'Partial'] } }),
            PosOrder.countDocuments({ ...posFilter, paymentStatus: 'Paid' }),
            PosOrder.aggregate([
                { $match: posFilter },
                { $group: { _id: null, revenue: { $sum: '$total' } } }
            ]),
            PosOrder.findOne(posFilter).sort({ createdAt: -1 }).lean()
        ])
        const revenue = orderTotals[0] ? Number(orderTotals[0].revenue || 0) : 0

        moduleCards.push({
            moduleKey: 'pos',
            label: MODULE_LABELS.pos,
            icon: 'bi-receipt',
            total: orders,
            primaryText: `${paidOrders} paid orders`,
            secondaryText: `Rs ${revenue.toLocaleString('en-IN')} revenue`,
            alertCount: pendingOrders,
            link: '/orders'
        })

        if (latestOrder) {
            recentActivity.push(buildRecentItem(
                `POS order ${latestOrder.orderNumber || ''}`.trim(),
                latestOrder.customerName || 'Customer order',
                latestOrder.paymentStatus || 'Paid',
                latestOrder.createdAt,
                '/orders'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'salesManagement')) {
        const salesFilter = { createdBy: user.email }
        const [targets, atRiskTargets, teamMembers] = await Promise.all([
            SalesTarget.countDocuments(salesFilter),
            SalesTarget.countDocuments({ ...salesFilter, status: 'At Risk' }),
            SalesMember.countDocuments(salesFilter)
        ])

        moduleCards.push({
            moduleKey: 'salesManagement',
            label: MODULE_LABELS.salesManagement,
            icon: 'bi-bullseye',
            total: targets,
            primaryText: `${teamMembers} sales team members`,
            secondaryText: `${atRiskTargets} targets at risk`,
            alertCount: atRiskTargets,
            link: '/sales-targets'
        })
    }

    if (hasAnyPermission(permissions, 'projectManagement')) {
        const projectFilter = { createdBy: user.email }
        const projects = await ProjectBoard.find(projectFilter).sort({ updatedAt: -1 }).lean()
        const pendingTasks = projects.reduce((sum, project) => {
            return sum + (project.tasks || []).filter((task) => task.status !== 'Completed').length
        }, 0)
        const completedProjects = projects.filter((project) => project.status === 'Completed').length
        const latestProject = projects[0]

        moduleCards.push({
            moduleKey: 'projectManagement',
            label: MODULE_LABELS.projectManagement,
            icon: 'bi-kanban',
            total: projects.length,
            primaryText: `${completedProjects} completed projects`,
            secondaryText: `${pendingTasks} open tasks`,
            alertCount: pendingTasks,
            link: '/projects'
        })

        if (latestProject) {
            recentActivity.push(buildRecentItem(
                `Project updated: ${latestProject.title || 'Project'}`,
                latestProject.client || 'Project board updated',
                latestProject.status || 'Planning',
                latestProject.updatedAt || latestProject.createdAt,
                '/projects'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'leadManagement')) {
        const leadFilter = { createdBy: user.email }
        const [leads, openLeads, latestLead] = await Promise.all([
            BusinessLead.countDocuments(leadFilter),
            BusinessLead.countDocuments({ ...leadFilter, status: { $in: ['Open', 'Contacted'] } }),
            BusinessLead.findOne(leadFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'leadManagement',
            label: MODULE_LABELS.leadManagement,
            icon: 'bi-funnel-fill',
            total: leads,
            primaryText: `${openLeads} active leads`,
            secondaryText: `${Math.max(leads - openLeads, 0)} converted or dormant`,
            alertCount: openLeads,
            link: '/leads'
        })

        if (latestLead) {
            recentActivity.push(buildRecentItem(
                `Lead captured: ${latestLead.name || 'Lead'}`,
                latestLead.company || latestLead.email || 'Lead pipeline updated',
                latestLead.stage || latestLead.status || 'New',
                latestLead.createdAt,
                '/leads'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'dealManagement')) {
        const dealFilter = { createdBy: user.email }
        const [deals, wonDeals, dealTotals] = await Promise.all([
            DealPipeline.countDocuments(dealFilter),
            DealPipeline.countDocuments({ ...dealFilter, stage: 'Closed Won' }),
            DealPipeline.aggregate([
                { $match: dealFilter },
                { $group: { _id: null, value: { $sum: '$value' } } }
            ])
        ])
        const dealValue = dealTotals[0] ? Number(dealTotals[0].value || 0) : 0

        moduleCards.push({
            moduleKey: 'dealManagement',
            label: MODULE_LABELS.dealManagement,
            icon: 'bi-trophy',
            total: deals,
            primaryText: `${wonDeals} closed won`,
            secondaryText: `Rs ${dealValue.toLocaleString('en-IN')} pipeline value`,
            alertCount: Math.max(deals - wonDeals, 0),
            link: '/deals'
        })
    }

    if (hasAnyPermission(permissions, 'smsManagement')) {
        const smsFilter = { createdBy: user.email }
        const [campaigns, sentCampaigns, failedCampaigns] = await Promise.all([
            SmsCampaign.countDocuments(smsFilter),
            SmsCampaign.countDocuments({ ...smsFilter, status: { $in: ['Sent', 'Delivered'] } }),
            SmsCampaign.countDocuments({ ...smsFilter, status: 'Failed' })
        ])

        moduleCards.push({
            moduleKey: 'smsManagement',
            label: MODULE_LABELS.smsManagement,
            icon: 'bi-chat-square-text',
            total: campaigns,
            primaryText: `${sentCampaigns} sent or delivered`,
            secondaryText: `${failedCampaigns} failed campaigns`,
            alertCount: failedCampaigns,
            link: '/sms-campaigns'
        })
    }

    if (hasAnyPermission(permissions, 'emailNotification')) {
        const messageFilter = { createdByEmail: userEmail }
        const [messages, deliveredMessages, failedMessages] = await Promise.all([
            SentMessage.countDocuments(messageFilter),
            SentMessage.countDocuments({ ...messageFilter, status: 'Completed' }),
            SentMessage.countDocuments({ ...messageFilter, status: 'Failed' })
        ])

        moduleCards.push({
            moduleKey: 'emailNotification',
            label: MODULE_LABELS.emailNotification,
            icon: 'bi-envelope-paper',
            total: messages,
            primaryText: `${deliveredMessages} delivered messages`,
            secondaryText: `${failedMessages} failed attempts`,
            alertCount: failedMessages,
            link: '/notification-history'
        })
    }

    if (hasAnyPermission(permissions, 'eventsManagement')) {
        const eventFilter = { createdBy: user.email }
        const [events, upcomingEvents, registrations, latestEvent] = await Promise.all([
            EventSchedule.countDocuments(eventFilter),
            EventSchedule.countDocuments({ ...eventFilter, status: { $in: ['Scheduled', 'Upcoming'] } }),
            EventSchedule.countDocuments({ ...eventFilter, status: 'Registered' }),
            EventSchedule.findOne(eventFilter).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'eventsManagement',
            label: MODULE_LABELS.eventsManagement,
            icon: 'bi-calendar-event',
            total: events,
            primaryText: `${upcomingEvents} upcoming events`,
            secondaryText: `${registrations} registrations`,
            alertCount: upcomingEvents,
            link: '/calendar'
        })

        if (latestEvent) {
            recentActivity.push(buildRecentItem(
                `Event scheduled: ${latestEvent.title || 'Event'}`,
                latestEvent.venue || latestEvent.attendeeName || 'Event updated',
                latestEvent.status || 'Scheduled',
                latestEvent.startDate || latestEvent.createdAt,
                '/calendar'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'zoomMeeting')) {
        const [meetings, upcomingMeetings, latestMeeting] = await Promise.all([
            ZoomMeeting.countDocuments(),
            ZoomMeeting.countDocuments({ status: 'upcoming' }),
            ZoomMeeting.findOne().sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'zoomMeeting',
            label: MODULE_LABELS.zoomMeeting,
            icon: 'bi-camera-video',
            total: meetings,
            primaryText: `${upcomingMeetings} upcoming meetings`,
            secondaryText: `${Math.max(meetings - upcomingMeetings, 0)} completed or cancelled`,
            alertCount: upcomingMeetings,
            link: '/meetings-list'
        })

        if (latestMeeting) {
            recentActivity.push(buildRecentItem(
                `Meeting scheduled: ${latestMeeting.title || 'Zoom meeting'}`,
                latestMeeting.dateTime || latestMeeting.zoomId || 'Meeting updated',
                latestMeeting.status || 'upcoming',
                latestMeeting.updatedAt || latestMeeting.createdAt,
                '/meetings-list'
            ))
        }
    }

    if (hasAnyPermission(permissions, 'supportDeskManagement')) {
        const supportFilter = { createdBy: user.email }
        const [tickets, openTickets, latestTicket] = await Promise.all([
            SupportDeskRecord.countDocuments({ ...supportFilter, type: 'Ticket' }),
            SupportDeskRecord.countDocuments({ ...supportFilter, type: 'Ticket', status: { $in: ['Open', 'In Progress'] } }),
            SupportDeskRecord.findOne({ ...supportFilter, type: 'Ticket' }).sort({ createdAt: -1 }).lean()
        ])

        moduleCards.push({
            moduleKey: 'supportDeskManagement',
            label: MODULE_LABELS.supportDeskManagement,
            icon: 'bi-headset',
            total: tickets,
            primaryText: `${openTickets} open tickets`,
            secondaryText: `${Math.max(tickets - openTickets, 0)} resolved`,
            alertCount: openTickets,
            link: '/tickets'
        })

        if (latestTicket) {
            recentActivity.push(buildRecentItem(
                `Support ticket: ${latestTicket.title || 'Ticket'}`,
                latestTicket.customerName || latestTicket.category || 'Support record updated',
                latestTicket.status || 'Open',
                latestTicket.createdAt,
                '/tickets'
            ))
        }
    }

    const sortedCards = moduleCards.sort((a, b) => b.alertCount - a.alertCount || b.total - a.total)
    const sortedActivity = recentActivity
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10)

    return {
        summaryCards: [
            { label: 'Accessible Modules', value: sortedCards.length, helpText: 'Modules available for this login' },
            { label: 'Tracked Records', value: sumBy(sortedCards, 'total'), helpText: 'Records visible on your dashboard' },
            { label: 'Attention Needed', value: sumBy(sortedCards, 'alertCount'), helpText: 'Items that need follow-up' },
            { label: 'Recent Updates', value: sortedActivity.length, helpText: 'Latest business activity' }
        ],
        moduleCards: sortedCards,
        recentActivity: sortedActivity
    }
}

async function buildSuperAdminDashboard() {
    const [
        allUsersRaw,
        plans,
        totalQueries,
        repliedQueries,
        contactsCount,
        employeeCount,
        productCount,
        posMetrics,
        leadsCount,
        dealsMetrics,
        projectCount,
        faqCount,
        featureCount,
        solutionCount
    ] = await Promise.all([
        authTable.find().sort({ _id: -1 }).lean(),
        userPlan.find().sort({ createdAt: -1 }).limit(8).lean(),
        queryTable.countDocuments(),
        queryTable.countDocuments({ replied: true }),
        CRM.countDocuments(),
        Employee.countDocuments(),
        Product.countDocuments(),
        PosOrder.aggregate([{ $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
        BusinessLead.countDocuments(),
        DealPipeline.aggregate([{ $group: { _id: null, deals: { $sum: 1 }, value: { $sum: '$value' } } }]),
        ProjectBoard.countDocuments(),
        faqTable.countDocuments(),
        featureTable.countDocuments(),
        solutionTable.countDocuments()
    ])

    const allUsers = allUsersRaw.map((u) => ({
        ...u,
        normalizedRole: normalizeRole(u.role)
    }))

    const roleBreakdown = {
        SuperAdmin: allUsers.filter((u) => u.normalizedRole === 'SuperAdmin').length,
        Company: allUsers.filter((u) => u.normalizedRole === 'Company').length,
        Employee: allUsers.filter((u) => u.normalizedRole === 'Employee').length,
        Customer: allUsers.filter((u) => u.normalizedRole === 'Customer').length,
        Vendor: allUsers.filter((u) => u.normalizedRole === 'Vendor').length
    }

    const statusBreakdown = {
        Active: allUsers.filter((u) => u.status === 'Active').length,
        Inactive: allUsers.filter((u) => u.status === 'Inactive').length,
        Suspended: allUsers.filter((u) => u.status === 'Suspended').length
    }

    const pendingQueries = Math.max(totalQueries - repliedQueries, 0)
    const activePlans = plans.filter((plan) => plan.subscriptionStatus === 'Active').length
    const paidPlans = plans.filter((plan) => plan.paymentStatus === 'Paid').length
    const posSummary = posMetrics[0] || { orders: 0, revenue: 0 }
    const dealSummary = dealsMetrics[0] || { deals: 0, value: 0 }

    const recentUsers = allUsers.slice(0, 8).map((u) => ({
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User',
        email: u.email || '-',
        role: u.normalizedRole,
        status: u.status || 'Inactive',
        createdAt: u._id && typeof u._id.getTimestamp === 'function' ? u._id.getTimestamp() : new Date()
    }))

    const recentQueries = await queryTable
        .find({}, { firstName: 1, lastName: 1, message: 1, replied: 1, createdDate: 1 })
        .sort({ createdDate: -1 })
        .limit(6)
        .lean()

    return {
        stats: [
            { label: 'Total Users', value: allUsers.length, helpText: `${statusBreakdown.Active} active accounts` },
            { label: 'Companies', value: roleBreakdown.Company, helpText: 'Company-side logins on platform' },
            { label: 'Active Plans', value: activePlans, helpText: `${paidPlans} paid subscriptions` },
            { label: 'Pending Queries', value: pendingQueries, helpText: `${repliedQueries} queries already replied` }
        ],
        spotlightCards: [
            { label: 'CRM Contacts', value: contactsCount, meta: 'Platform-wide customer records', icon: 'bi-people-fill', link: '/addcontacttable' },
            { label: 'HR Employees', value: employeeCount, meta: 'Employees managed in HRM', icon: 'bi-person-badge', link: '/employees' },
            { label: 'Products', value: productCount, meta: 'Products in catalog', icon: 'bi-box-seam', link: '/producttable' },
            { label: 'POS Orders', value: posSummary.orders || 0, meta: `Rs ${Number(posSummary.revenue || 0).toLocaleString('en-IN')} revenue`, icon: 'bi-receipt', link: '/orders' },
            { label: 'Leads', value: leadsCount, meta: 'Business leads in pipeline', icon: 'bi-funnel-fill', link: '/leads' },
            { label: 'Deals', value: dealSummary.deals || 0, meta: `Rs ${Number(dealSummary.value || 0).toLocaleString('en-IN')} pipeline`, icon: 'bi-trophy', link: '/deals' },
            { label: 'Projects', value: projectCount, meta: 'Projects being tracked', icon: 'bi-kanban', link: '/projects' },
            { label: 'Frontend Content', value: faqCount + featureCount + solutionCount, meta: `${faqCount} FAQs and ${featureCount + solutionCount} sections`, icon: 'bi-window', link: '/faqtable' }
        ],
        roleBreakdown,
        statusBreakdown,
        recentUsers,
        recentPlans: plans,
        recentQueries,
        allUsers
    }
}

router.get('/login', (req, res) => {
    let mess = ""
    res.render("Auth/Login.ejs", { mess })
})

router.post('/login', async (req, res) => {
    let mess = ""
    try {
        const { email, password } = req.body
        const Email = await authTable.findOne({ email: email })

        if (!Email) {
            return res.render("Auth/Login.ejs", { mess: "Wrong Username/Email" })
        }

        const changepass = await bcrypt.compare(password, Email.password)

        if (!changepass) {
            return res.render("Auth/Login.ejs", { mess: "Wrong Password" })
        }

        if (Email.status === "Suspended") {
            return res.render("Auth/Login.ejs", { mess: "Your account has been suspended." })
        }

        if (Email.status !== "Active") {
            return res.render("Auth/Login.ejs", { mess: "Please activate your account from email first." })
        }

        // Store user data in session
        req.session.isAuth = true
        req.session.email = Email.email
        req.session.userId = Email._id
        req.session.userName = `${Email.firstName} ${Email.lastName}`
        req.session.userRole = normalizeRole(Email.role)

        // Centralized role-based dashboard route
        return res.redirect("/dashboard")

    } catch (error) {
        console.error('Login error:', error)
        return res.render("Auth/Login.ejs", { mess: "Something went wrong" })
    }
})

router.get('/accountActive/:id', async (req, res) => {
    try {
        const id = req.params.id
        await authTable.findByIdAndUpdate(id, { status: "Active" })
        res.render("Auth/accountActivated.ejs")
    } catch (error) {
        res.send("Activation failed")
    }
})

router.get('/register', (req, res) => {
    let mess = ""
    res.render("Auth/signup.ejs", { mess })
})

router.post('/register', async (req, res) => {
    let mess = ""
    try {
        const { firstname, lastname, email, password,mobile,dob } = req.body
        if (!firstname || !lastname || !email || !password || !mobile || !dob) {
            throw new Error("all Input are not filled")
        }
        const EmailCheck = await authTable.findOne({ email: email })
        if (EmailCheck) {
            throw new Error(`${email} Email-id Already Exist.`)
        }
        const cpass = await bcrypt.hash(password, 10)
        const Record = await new authTable({
            firstName: firstname,
            lastName: lastname,
            email: email,
            password: cpass,
            mobile:mobile,
            dob:dob,
            status: "Inactive",
            role: "Manager"
        })
        await Record.save()
        console.log(Record)
        
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: "swatis8102@gmail.com",
                pass: "bljvqtvbllernhdy",
            },
        });

        await transporter.sendMail({
            from: "swatis8102@gmail.com",
            to: email,
            subject: "Account Activation",
            html: `<h3>Click below link to activate your account</h3>
                   <a href="http://localhost:5000/accountActive/${Record._id}">
                   Activate Account
                   </a>`
        });
        mess = "Successfully Account Has been created"
    } catch (error) {
        mess = error.message
    }
    res.render("Auth/signup.ejs", { mess })
})

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await authTable.findOne({ email: req.session.email })
        if (!user) {
            return res.redirect('/login')
        }

        const role = normalizeRole(user.role)
        const userData = {
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userRole: role,
            userInitial: user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U',
            userInitials: user.firstName && user.lastName ? 
                `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 
                (user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U')
        }

        if (role === "SuperAdmin") {
            const superAdminData = await buildSuperAdminDashboard()
            return res.render("Home/SuperAdminDashboard.ejs", {
                ...userData,
                ...superAdminData
            })
        }
        const permissions = req.modulePermissions || await getPermissionsForRole(role)
        const companyDashboard = await buildCompanyDashboard(user, permissions)

        return res.render("Home/Dashboard.ejs", {
            ...userData,
            modulePermissions: permissions,
            dashboardStats: companyDashboard.summaryCards,
            dashboardData: companyDashboard
        })
    } catch (error) {
        console.error('Dashboard error:', error)
        return res.redirect('/login')
    }
})
router.get('/hproducts',(req,res)=>{
    res.render("Home/HProduct")
})

router.get('/no-access', requireAuth, (req, res) => {
    const moduleName = req.query.module || "This module"
    const actionName = req.query.action || "requested action"
    return res.render("Home/NoAccess.ejs", { moduleName, actionName })
})
// ================= GET =================
router.get('/forgotpasswordform', (req, res) => {
    res.render("Auth/forgotpasswordForm.ejs", {
        mess: "",
        step: "email"
    })
})

// ================= POST =================
router.post('/forgotpasswordform', async (req, res) => {
    let mess = ""
    const { email, otp, newpassword } = req.body

    try {
        // ================= STEP 1: SEND OTP =================
        if (email && !otp && !newpassword) {
            const user = await authTable.findOne({ email })

            if (!user) {
                throw new Error("Email Not Found")
            }

            const generateOtp = Math.floor(100000 + Math.random() * 900000)

            user.otp = generateOtp
            await user.save()

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: "swatis8102@gmail.com",
                    pass: "bljvqtvbllernhdy"
                }
            })

            await transporter.sendMail({
                from: "swatis8102@gmail.com",
                to: email,
                subject: "OTP Verification",
                html: `<h2>Your OTP is: ${generateOtp}</h2>`
            })

            mess = "OTP Sent Successfully"

            return res.render("Auth/forgotpasswordForm.ejs", {
                mess,
                step: "otp",
                email
            })
        }

        // ================= STEP 2: VERIFY OTP =================
        if (email && otp && !newpassword) {
            const user = await authTable.findOne({ email })

            if (!user || user.otp != otp) {
                throw new Error("Invalid OTP")
            }

            mess = "OTP Verified"

            return res.render("Auth/forgotpasswordForm.ejs", {
                mess,
                step: "reset",
                email
            })
        }

        // ================= STEP 3: RESET PASSWORD =================
        if (email && newpassword) {
            const hash = await bcrypt.hash(newpassword, 10)
            await authTable.findOneAndUpdate(
                { email },
                { password: hash, otp: null }
            )
            return res.redirect('/login')
        }

    } catch (error) {
        mess = error.message
        return res.render("Auth/forgotpasswordForm.ejs", {
            mess,
            step: "email"
        })
    }
})

router.get('/changepassword/:id', (req, res) => {
    const mess = ""
    res.render("Auth/newpasswordform.ejs", { mess })
})

router.post('/changepassword/:id', async (req, res) => {
    let mess = ""
    try {
        const { newpassword, conpassword } = req.body
        if (newpassword != conpassword) {
            throw new Error("Password Not match")
        }
        const id = req.params.id
        const changePass = await bcrypt.hash(newpassword, 10)
        await authTable.findByIdAndUpdate(id, { password: changePass })
        mess = "password change successfully"
        res.redirect('/successfullyLogin')
    } catch (error) {
        mess = error.message
        res.render("Auth/newpasswordform.ejs", { mess })
    }
})

router.get('/successfullylogin', (req, res) => {
    res.render('Auth/successfullyLogin.ejs');
});

router.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/login')
})

// Add this middleware to pass user data to all pages
router.use(async (req, res, next) => {
    if (req.session && req.session.email) {
        try {
            const user = await authTable.findOne({ email: req.session.email })
            if (user) {
                res.locals.userName = `${user.firstName} ${user.lastName}`
                res.locals.userEmail = user.email
                res.locals.userRole = normalizeRole(user.role)
                res.locals.userInitial = user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'
                res.locals.userInitials = user.firstName && user.lastName ? 
                    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 
                    (user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U')
            }
        } catch (error) {
            console.error('Error getting user data:', error)
        }
    }
    next()  
})

module.exports = router
