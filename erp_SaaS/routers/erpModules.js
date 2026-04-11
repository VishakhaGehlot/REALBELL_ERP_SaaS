const router = require("express").Router()
const Product = require("../models/product")
const PosOrder = require("../models/PosOrder")
const SalesTarget = require("../models/SalesTarget")
const SalesMember = require("../models/SalesMember")
const ProjectBoard = require("../models/ProjectBoard")
const BusinessLead = require("../models/BusinessLead")
const AccountingEntry = require("../models/AccountingEntry")
const DealPipeline = require("../models/DealPipeline")
const SmsCampaign = require("../models/SmsCampaign")
const EventSchedule = require("../models/EventSchedule")
const SupportDeskRecord = require("../models/SupportDeskRecord")
const SecurityRecord = require("../models/SecurityRecord")
const { requireAuth, resolveRequestRole } = require("../middleware/roleAuth")
const { requireModuleAccess } = require("../middleware/permissionAuth")

router.use(requireAuth)

function getLoginName(req) {
    return req.session.email || "Admin"
}

async function buildOwnerFilter(req) {
    const role = await resolveRequestRole(req)
    if (role === "SuperAdmin") {
        return {}
    }
    return { createdBy: getLoginName(req) }
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function buildOrderNumber() {
    return `POS-${Date.now().toString().slice(-8)}`
}

function getStockStatus(stockValue) {
    const stock = toNumber(stockValue, 0)
    if (stock <= 0) return "Out of Stock"
    if (stock <= 5) return "Low Stock"
    if (stock <= 10) return "Limited Stock"
    return "In Stock"
}

function normalizeToArray(value) {
    if (Array.isArray(value)) return value
    if (typeof value === "undefined" || value === null) return []
    return [value]
}

async function getPosPageData(req, activeTab = "new-sale", extra = {}) {
    const ownerFilter = await buildOwnerFilter(req)
    const [products, orders] = await Promise.all([
        Product.find().sort({ createdAt: -1 }).lean(),
        PosOrder.find(ownerFilter).sort({ createdAt: -1 }).lean()
    ])

    const totalRevenue = orders.reduce((sum, order) => sum + toNumber(order.total, 0), 0)
    const pendingOrders = orders.filter((order) => String(order.paymentStatus || "").toLowerCase() === "pending").length
    const lowStockItems = products.filter((product) => toNumber(product.stock, 0) > 0 && toNumber(product.stock, 0) <= 5).length

    return {
        loginname: getLoginName(req),
        activeTab,
        products,
        orders,
        inventoryItems: products,
        recentOrders: orders.slice(0, 5),
        pageTitle: activeTab === "orders" ? "POS Orders" : activeTab === "inventory" ? "POS Inventory" : "New Sale",
        posStats: {
            totalOrders: orders.length,
            totalRevenue,
            pendingOrders,
            lowStockItems
        },
        ...extra
    }
}

router.get("/new-sale", requireModuleAccess("pos", "add"), async (req, res) => {
    res.render("ERP/POS.ejs", await getPosPageData(req, "new-sale", {
        message: req.query.message || "",
        error: req.query.error || ""
    }))
})

router.post("/new-sale", requireModuleAccess("pos", "add"), async (req, res) => {
    const productIds = normalizeToArray(req.body.productIds)
    const quantities = normalizeToArray(req.body.quantities)

    const rowItems = productIds
        .map((productId, index) => ({
            productId: String(productId || "").trim(),
            quantity: toNumber(quantities[index], 0)
        }))
        .filter((item) => item.productId && item.quantity > 0)

    if (!req.body.customerName || rowItems.length === 0) {
        return res.status(400).render("ERP/POS.ejs", await getPosPageData(req, "new-sale", {
            error: "Customer name aur kam se kam ek valid product quantity dena zaroori hai."
        }))
    }

    const uniqueProductIds = [...new Set(rowItems.map((item) => item.productId))]
    const dbProducts = await Product.find({ _id: { $in: uniqueProductIds } })
    const productMap = new Map(dbProducts.map((product) => [String(product._id), product]))
    const selectedItems = []

    for (const rowItem of rowItems) {
        const product = productMap.get(rowItem.productId)
        if (!product) {
            return res.status(400).render("ERP/POS.ejs", await getPosPageData(req, "new-sale", {
                error: "Selected product list me ek ya zyada items invalid hain."
            }))
        }

        if (rowItem.quantity > toNumber(product.stock, 0)) {
            return res.status(400).render("ERP/POS.ejs", await getPosPageData(req, "new-sale", {
                error: `${product.name} ke liye available stock se zyada quantity select hui hai.`
            }))
        }

        const price = toNumber(product.price, 0)
        selectedItems.push({
            productId: product._id,
            name: product.name,
            quantity: rowItem.quantity,
            price,
            total: rowItem.quantity * price
        })
    }

    for (const item of selectedItems) {
        const product = productMap.get(String(item.productId))
        const updatedStock = Math.max(0, toNumber(product.stock, 0) - toNumber(item.quantity, 0))
        product.stock = updatedStock
        product.status = getStockStatus(updatedStock)
        await product.save()
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + item.total, 0)
    const taxPercent = Math.max(0, toNumber(req.body.taxPercent, 0))
    const taxAmount = (subtotal * taxPercent) / 100

    await PosOrder.create({
        orderNumber: buildOrderNumber(),
        customerName: req.body.customerName,
        items: selectedItems,
        subtotal,
        taxPercent,
        taxAmount,
        total: subtotal + taxAmount,
        paymentStatus: req.body.paymentStatus || "Paid",
        salesOwner: req.body.salesOwner || getLoginName(req),
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })

    res.redirect("/orders?message=Order%20created%20successfully")
})

router.get("/orders", requireModuleAccess("pos"), async (req, res) => {
    res.render("ERP/POS.ejs", await getPosPageData(req, "orders", {
        message: req.query.message || "",
        error: req.query.error || ""
    }))
})

router.get("/inventory", requireModuleAccess("pos"), async (req, res) => {
    res.render("ERP/POS.ejs", await getPosPageData(req, "inventory", {
        message: req.query.message || "",
        error: req.query.error || ""
    }))
})

router.post("/orders/delete/:id", requireModuleAccess("pos", "delete"), async (req, res) => {
    const order = await PosOrder.findOne({ _id: req.params.id, ...(await buildOwnerFilter(req)) })

    if (!order) {
        return res.redirect("/orders?error=Order%20not%20found")
    }

    for (const item of order.items || []) {
        if (!item.productId) continue
        const product = await Product.findById(item.productId)
        if (!product) continue

        const updatedStock = toNumber(product.stock, 0) + toNumber(item.quantity, 0)
        product.stock = updatedStock
        product.status = getStockStatus(updatedStock)
        await product.save()
    }

    await PosOrder.deleteOne({ _id: order._id })
    res.redirect("/orders?message=Order%20deleted%20and%20inventory%20restored")
})

router.get("/sales-targets", requireModuleAccess("salesManagement"), async (req, res) => {
    const ownerFilter = await buildOwnerFilter(req)
    const [targets, team] = await Promise.all([
        SalesTarget.find(ownerFilter).sort({ createdAt: -1 }).lean(),
        SalesMember.find(ownerFilter).sort({ createdAt: -1 }).lean()
    ])

    res.render("ERP/SalesManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "targets",
        targets,
        team,
        commissions: [],
        pageTitle: "Sales Targets"
    })
})

router.post("/sales-targets", requireModuleAccess("salesManagement", "add"), async (req, res) => {
    await SalesTarget.create({
        title: req.body.title,
        owner: req.body.owner,
        period: req.body.period,
        targetAmount: toNumber(req.body.targetAmount, 0),
        achievedAmount: toNumber(req.body.achievedAmount, 0),
        category: req.body.category || "Revenue",
        status: req.body.status || "On Track",
        createdBy: getLoginName(req)
    })

    res.redirect("/sales-targets")
})

router.get("/sales-team", requireModuleAccess("salesManagement"), async (req, res) => {
    const ownerFilter = await buildOwnerFilter(req)
    const [targets, team, orders] = await Promise.all([
        SalesTarget.find(ownerFilter).sort({ createdAt: -1 }).lean(),
        SalesMember.find(ownerFilter).sort({ createdAt: -1 }).lean(),
        PosOrder.find(ownerFilter).sort({ createdAt: -1 }).lean()
    ])

    const revenueMap = orders.reduce((acc, order) => {
        const key = String(order.salesOwner || "").trim().toLowerCase()
        acc[key] = (acc[key] || 0) + toNumber(order.total, 0)
        return acc
    }, {})

    const enrichedTeam = team.map((member) => ({
        ...member,
        closedRevenue: revenueMap[String(member.name || "").trim().toLowerCase()] || 0
    }))

    res.render("ERP/SalesManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "team",
        targets,
        team: enrichedTeam,
        commissions: [],
        pageTitle: "Sales Team"
    })
})

router.post("/sales-team", requireModuleAccess("salesManagement", "add"), async (req, res) => {
    await SalesMember.create({
        name: req.body.name,
        email: req.body.email,
        region: req.body.region,
        monthlyTarget: toNumber(req.body.monthlyTarget, 0),
        commissionRate: toNumber(req.body.commissionRate, 5),
        status: req.body.status || "Active",
        createdBy: getLoginName(req)
    })

    res.redirect("/sales-team")
})

router.get("/commission", requireModuleAccess("salesManagement"), async (req, res) => {
    const ownerFilter = await buildOwnerFilter(req)
    const [team, orders, targets] = await Promise.all([
        SalesMember.find(ownerFilter).sort({ createdAt: -1 }).lean(),
        PosOrder.find(ownerFilter).sort({ createdAt: -1 }).lean(),
        SalesTarget.find(ownerFilter).sort({ createdAt: -1 }).lean()
    ])

    const commissions = team.map((member) => {
        const revenue = orders
            .filter((order) => String(order.salesOwner || "").trim().toLowerCase() === String(member.name || "").trim().toLowerCase())
            .reduce((sum, order) => sum + toNumber(order.total, 0), 0)

        return {
            ...member,
            closedRevenue: revenue,
            commissionValue: (revenue * toNumber(member.commissionRate, 0)) / 100
        }
    })

    res.render("ERP/SalesManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "commission",
        targets,
        team,
        commissions,
        pageTitle: "Commission Tracking"
    })
})

router.get("/projects", requireModuleAccess("projectManagement"), async (req, res) => {
    const projects = await ProjectBoard.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).lean()
    res.render("ERP/Projects.ejs", {
        loginname: getLoginName(req),
        activeTab: "projects",
        projects,
        flattenedTasks: [],
        flattenedMilestones: [],
        pageTitle: "Projects"
    })
})

router.post("/projects", requireModuleAccess("projectManagement", "add"), async (req, res) => {
    const teamMembers = String(req.body.teamMembers || "")
        .split(",")
        .map((member) => member.trim())
        .filter(Boolean)

    await ProjectBoard.create({
        title: req.body.title,
        client: req.body.client,
        status: req.body.status || "Planning",
        budget: toNumber(req.body.budget, 0),
        progress: toNumber(req.body.progress, 0),
        dueDate: req.body.dueDate || null,
        teamMembers,
        tasks: [
            {
                title: req.body.taskTitle || "Kickoff Task",
                assignee: req.body.taskAssignee || "",
                priority: req.body.taskPriority || "Medium",
                status: "Pending",
                dueDate: req.body.taskDueDate || null
            }
        ],
        milestones: [
            {
                title: req.body.milestoneTitle || "Project Kickoff",
                dueDate: req.body.milestoneDueDate || req.body.dueDate || null,
                status: "Pending"
            }
        ],
        createdBy: getLoginName(req)
    })

    res.redirect("/projects")
})

router.get("/tasks", requireModuleAccess("projectManagement"), async (req, res) => {
    const projects = await ProjectBoard.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).lean()
    const flattenedTasks = projects.flatMap((project) =>
        (project.tasks || []).map((task) => ({
            ...task,
            projectTitle: project.title,
            client: project.client
        }))
    )

    res.render("ERP/Projects.ejs", {
        loginname: getLoginName(req),
        activeTab: "tasks",
        projects,
        flattenedTasks,
        flattenedMilestones: [],
        pageTitle: "Tasks"
    })
})

router.get("/timeline", requireModuleAccess("projectManagement"), async (req, res) => {
    const projects = await ProjectBoard.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).lean()
    const flattenedMilestones = projects.flatMap((project) =>
        (project.milestones || []).map((milestone) => ({
            ...milestone,
            projectTitle: project.title,
            client: project.client
        }))
    )

    res.render("ERP/Projects.ejs", {
        loginname: getLoginName(req),
        activeTab: "timeline",
        projects,
        flattenedTasks: [],
        flattenedMilestones,
        pageTitle: "Timeline"
    })
})

router.get("/leads", requireModuleAccess("leadManagement"), async (req, res) => {
    const leads = await BusinessLead.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).lean()
    res.render("ERP/LeadManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "leads",
        leads,
        pageTitle: "All Leads"
    })
})

router.get("/lead-capture", requireModuleAccess("leadManagement", "add"), async (req, res) => {
    const leads = await BusinessLead.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).limit(5).lean()
    res.render("ERP/LeadManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "capture",
        leads,
        pageTitle: "Lead Capture"
    })
})

router.post("/lead-capture", requireModuleAccess("leadManagement", "add"), async (req, res) => {
    await BusinessLead.create({
        name: req.body.name,
        company: req.body.company,
        email: req.body.email,
        phone: req.body.phone,
        source: req.body.source || "Website",
        stage: req.body.stage || "New",
        score: toNumber(req.body.score, 50),
        estimatedValue: toNumber(req.body.estimatedValue, 0),
        assignedTo: req.body.assignedTo || "",
        nextFollowUp: req.body.nextFollowUp || null,
        notes: req.body.notes || "",
        status: req.body.status || "Open",
        createdBy: getLoginName(req)
    })

    res.redirect("/leads")
})

router.get("/lead-score", requireModuleAccess("leadManagement"), async (req, res) => {
    const leads = await BusinessLead.find(await buildOwnerFilter(req)).sort({ score: -1, createdAt: -1 }).lean()
    res.render("ERP/LeadManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "score",
        leads,
        pageTitle: "Lead Scoring"
    })
})

router.get("/ledger", requireModuleAccess("accounting"), async (req, res) => {
    const entries = await AccountingEntry.find({ ...(await buildOwnerFilter(req)), type: "Ledger" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Accounting.ejs", {
        loginname: getLoginName(req),
        activeTab: "ledger",
        entries,
        pageTitle: "General Ledger"
    })
})

router.post("/ledger", requireModuleAccess("accounting", "add"), async (req, res) => {
    await AccountingEntry.create({
        type: "Ledger",
        title: req.body.title,
        category: req.body.category,
        amount: toNumber(req.body.amount, 0),
        status: req.body.status || "Posted",
        entryDate: req.body.entryDate || null,
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/ledger")
})

router.get("/expenses", requireModuleAccess("accounting"), async (req, res) => {
    const entries = await AccountingEntry.find({ ...(await buildOwnerFilter(req)), type: "Expense" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Accounting.ejs", {
        loginname: getLoginName(req),
        activeTab: "expenses",
        entries,
        pageTitle: "Expenses"
    })
})

router.post("/expenses", requireModuleAccess("accounting", "add"), async (req, res) => {
    await AccountingEntry.create({
        type: "Expense",
        title: req.body.title,
        category: req.body.category,
        amount: toNumber(req.body.amount, 0),
        status: req.body.status || "Pending",
        entryDate: req.body.entryDate || null,
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/expenses")
})

router.get("/tax", requireModuleAccess("accounting"), async (req, res) => {
    const entries = await AccountingEntry.find({ ...(await buildOwnerFilter(req)), type: "Tax" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Accounting.ejs", {
        loginname: getLoginName(req),
        activeTab: "tax",
        entries,
        pageTitle: "Tax Management"
    })
})

router.post("/tax", requireModuleAccess("accounting", "add"), async (req, res) => {
    await AccountingEntry.create({
        type: "Tax",
        title: req.body.title,
        category: req.body.category,
        amount: toNumber(req.body.amount, 0),
        status: req.body.status || "Draft",
        entryDate: req.body.entryDate || null,
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/tax")
})

router.get("/deals", requireModuleAccess("dealManagement"), async (req, res) => {
    const deals = await DealPipeline.find(await buildOwnerFilter(req)).sort({ createdAt: -1 }).lean()
    res.render("ERP/Deals.ejs", {
        loginname: getLoginName(req),
        activeTab: "deals",
        deals,
        pageTitle: "Active Deals"
    })
})

router.post("/deals", requireModuleAccess("dealManagement", "add"), async (req, res) => {
    await DealPipeline.create({
        title: req.body.title,
        company: req.body.company,
        owner: req.body.owner || getLoginName(req),
        value: toNumber(req.body.value, 0),
        stage: req.body.stage || "Discovery",
        expectedCloseDate: req.body.expectedCloseDate || null,
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/deals")
})

router.get("/negotiation", requireModuleAccess("dealManagement"), async (req, res) => {
    const deals = await DealPipeline.find({
        ...(await buildOwnerFilter(req)),
        stage: { $in: ["Proposal", "Negotiation"] }
    }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Deals.ejs", {
        loginname: getLoginName(req),
        activeTab: "negotiation",
        deals,
        pageTitle: "Negotiation Logs"
    })
})

router.get("/closed-won", requireModuleAccess("dealManagement"), async (req, res) => {
    const deals = await DealPipeline.find({
        ...(await buildOwnerFilter(req)),
        stage: "Closed Won"
    }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Deals.ejs", {
        loginname: getLoginName(req),
        activeTab: "closed-won",
        deals,
        pageTitle: "Closed Won"
    })
})

router.get("/sms-templates", requireModuleAccess("smsManagement"), async (req, res) => {
    const campaigns = await SmsCampaign.find({ ...(await buildOwnerFilter(req)), type: "Template" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SMSManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "templates",
        campaigns,
        pageTitle: "SMS Templates"
    })
})

router.post("/sms-templates", requireModuleAccess("smsManagement", "add"), async (req, res) => {
    await SmsCampaign.create({
        type: "Template",
        name: req.body.name,
        audience: req.body.audience || "",
        content: req.body.content || "",
        status: req.body.status || "Draft",
        createdBy: getLoginName(req)
    })
    res.redirect("/sms-templates")
})

router.get("/sms-campaigns", requireModuleAccess("smsManagement"), async (req, res) => {
    const campaigns = await SmsCampaign.find({ ...(await buildOwnerFilter(req)), type: "Campaign" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SMSManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "campaigns",
        campaigns,
        pageTitle: "SMS Campaigns"
    })
})

router.post("/sms-campaigns", requireModuleAccess("smsManagement", "add"), async (req, res) => {
    await SmsCampaign.create({
        type: "Campaign",
        name: req.body.name,
        audience: req.body.audience || "",
        content: req.body.content || "",
        status: req.body.status || "Scheduled",
        scheduledAt: req.body.scheduledAt || null,
        createdBy: getLoginName(req)
    })
    res.redirect("/sms-campaigns")
})

router.get("/sms-logs", requireModuleAccess("smsManagement"), async (req, res) => {
    const campaigns = await SmsCampaign.find({ ...(await buildOwnerFilter(req)), type: "Log" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SMSManagement.ejs", {
        loginname: getLoginName(req),
        activeTab: "logs",
        campaigns,
        pageTitle: "SMS Delivery Logs"
    })
})

router.post("/sms-logs", requireModuleAccess("smsManagement", "add"), async (req, res) => {
    await SmsCampaign.create({
        type: "Log",
        name: req.body.name,
        audience: req.body.audience || "",
        content: req.body.content || "",
        status: req.body.status || "Delivered",
        scheduledAt: req.body.scheduledAt || null,
        createdBy: getLoginName(req)
    })
    res.redirect("/sms-logs")
})

router.get("/calendar", requireModuleAccess("eventsManagement"), async (req, res) => {
    const events = await EventSchedule.find(await buildOwnerFilter(req)).sort({ startDate: 1, createdAt: -1 }).lean()
    res.render("ERP/Events.ejs", {
        loginname: getLoginName(req),
        activeTab: "calendar",
        events,
        pageTitle: "Calendar View"
    })
})

router.post("/calendar", requireModuleAccess("eventsManagement", "add"), async (req, res) => {
    await EventSchedule.create({
        title: req.body.title,
        type: req.body.type || "Meeting",
        venue: req.body.venue || "",
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        attendeeName: req.body.attendeeName || "",
        status: req.body.status || "Scheduled",
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/calendar")
})

router.get("/upcoming-events", requireModuleAccess("eventsManagement"), async (req, res) => {
    const events = await EventSchedule.find({
        ...(await buildOwnerFilter(req)),
        status: { $in: ["Scheduled", "Upcoming"] }
    }).sort({ startDate: 1 }).lean()
    res.render("ERP/Events.ejs", {
        loginname: getLoginName(req),
        activeTab: "upcoming",
        events,
        pageTitle: "Upcoming Events"
    })
})

router.get("/event-registration", requireModuleAccess("eventsManagement"), async (req, res) => {
    const events = await EventSchedule.find({
        ...(await buildOwnerFilter(req)),
        $or: [{ status: "Registered" }, { attendeeName: { $ne: "" } }]
    }).sort({ createdAt: -1 }).lean()
    res.render("ERP/Events.ejs", {
        loginname: getLoginName(req),
        activeTab: "registrations",
        events,
        pageTitle: "Event Registrations"
    })
})

router.post("/event-registration", requireModuleAccess("eventsManagement", "add"), async (req, res) => {
    await EventSchedule.create({
        title: req.body.title,
        type: "Registration",
        venue: req.body.venue || "",
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        attendeeName: req.body.attendeeName || "",
        status: "Registered",
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/event-registration")
})

router.get("/tickets", requireModuleAccess("supportDeskManagement"), async (req, res) => {
    const records = await SupportDeskRecord.find({ ...(await buildOwnerFilter(req)), type: "Ticket" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SupportDesk.ejs", {
        loginname: getLoginName(req),
        activeTab: "tickets",
        records,
        pageTitle: "All Tickets"
    })
})

router.post("/tickets", requireModuleAccess("supportDeskManagement", "add"), async (req, res) => {
    await SupportDeskRecord.create({
        type: "Ticket",
        title: req.body.title,
        customerName: req.body.customerName || "",
        category: req.body.category || "",
        content: req.body.content || "",
        priority: req.body.priority || "Medium",
        status: req.body.status || "Open",
        createdBy: getLoginName(req)
    })
    res.redirect("/tickets")
})

router.get("/knowledge-base", requireModuleAccess("supportDeskManagement"), async (req, res) => {
    const records = await SupportDeskRecord.find({ ...(await buildOwnerFilter(req)), type: "Knowledge" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SupportDesk.ejs", {
        loginname: getLoginName(req),
        activeTab: "knowledge",
        records,
        pageTitle: "Knowledge Base"
    })
})

router.post("/knowledge-base", requireModuleAccess("supportDeskManagement", "add"), async (req, res) => {
    await SupportDeskRecord.create({
        type: "Knowledge",
        title: req.body.title,
        customerName: req.body.customerName || "",
        category: req.body.category || "",
        content: req.body.content || "",
        priority: req.body.priority || "Low",
        status: req.body.status || "Published",
        createdBy: getLoginName(req)
    })
    res.redirect("/knowledge-base")
})

router.get("/live-chat", requireModuleAccess("supportDeskManagement"), async (req, res) => {
    const records = await SupportDeskRecord.find({ ...(await buildOwnerFilter(req)), type: "Chat" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SupportDesk.ejs", {
        loginname: getLoginName(req),
        activeTab: "chat",
        records,
        pageTitle: "Live Chat"
    })
})

router.post("/live-chat", requireModuleAccess("supportDeskManagement", "add"), async (req, res) => {
    await SupportDeskRecord.create({
        type: "Chat",
        title: req.body.title,
        customerName: req.body.customerName || "",
        category: req.body.category || "",
        content: req.body.content || "",
        priority: req.body.priority || "Medium",
        status: req.body.status || "Active",
        createdBy: getLoginName(req)
    })
    res.redirect("/live-chat")
})

router.get("/security", async (req, res) => {
    const records = await SecurityRecord.find({ ...(await buildOwnerFilter(req)), type: "Security" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SecurityCenter.ejs", {
        loginname: getLoginName(req),
        activeTab: "security",
        records,
        pageTitle: "Security"
    })
})

router.post("/security", async (req, res) => {
    await SecurityRecord.create({
        type: "Security",
        title: req.body.title,
        category: req.body.category || "",
        value: req.body.value || "",
        status: req.body.status || "Enabled",
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/security")
})

router.get("/system-security", async (req, res) => {
    const records = await SecurityRecord.find({ ...(await buildOwnerFilter(req)), type: "System" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SecurityCenter.ejs", {
        loginname: getLoginName(req),
        activeTab: "system-security",
        records,
        pageTitle: "System Security"
    })
})

router.post("/system-security", async (req, res) => {
    await SecurityRecord.create({
        type: "System",
        title: req.body.title,
        category: req.body.category || "",
        value: req.body.value || "",
        status: req.body.status || "Review",
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/system-security")
})

router.get("/settings", async (req, res) => {
    const records = await SecurityRecord.find({ ...(await buildOwnerFilter(req)), type: "Settings" }).sort({ createdAt: -1 }).lean()
    res.render("ERP/SecurityCenter.ejs", {
        loginname: getLoginName(req),
        activeTab: "settings",
        records,
        pageTitle: "System Settings"
    })
})

router.post("/settings", async (req, res) => {
    await SecurityRecord.create({
        type: "Settings",
        title: req.body.title,
        category: req.body.category || "",
        value: req.body.value || "",
        status: req.body.status || "Active",
        notes: req.body.notes || "",
        createdBy: getLoginName(req)
    })
    res.redirect("/settings")
})

module.exports = router
