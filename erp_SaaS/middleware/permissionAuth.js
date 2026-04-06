const RolePermission = require("../models/RolePermission")
const authTable = require("../models/auth")
const { normalizeRole } = require("./roleAuth")

const PERMISSION_KEYS = [
    "subscription",
    "crm",
    "hrm",
    "queryManagement",
    "frontendManagement",
    "productManagement",
    "accounting",
    "pos",
    "salesManagement",
    "projectManagement",
    "leadManagement",
    "dealManagement",
    "smsManagement",
    "emailNotification",
    "eventsManagement",
    "zoomMeeting",
    "supportDeskManagement"
]

const ACTION_KEYS = ["view", "add", "edit", "delete"]

const MODULE_LABELS = {
    subscription: "Subscription",
    crm: "CRM",
    hrm: "HRM",
    queryManagement: "Query Management",
    frontendManagement: "Frontend Management",
    productManagement: "Product Management",
    accounting: "Accounting",
    pos: "POS",
    salesManagement: "Sales Management",
    projectManagement: "Project Management",
    leadManagement: "Lead Management",
    dealManagement: "Deal Management",
    smsManagement: "SMS Management",
    emailNotification: "Email Notification",
    eventsManagement: "Events Management",
    zoomMeeting: "Zoom Meeting",
    supportDeskManagement: "Support Desk Management"
}

function moduleActionSet(value) {
    return {
        view: value,
        add: value,
        edit: value,
        delete: value
    }
}

const DEFAULT_PERMISSIONS = {
    SuperAdmin: {
        subscription: moduleActionSet(true),
        crm: moduleActionSet(true),
        hrm: moduleActionSet(true),
        queryManagement: moduleActionSet(true),
        frontendManagement: moduleActionSet(true),
        productManagement: moduleActionSet(true),
        accounting: moduleActionSet(true),
        pos: moduleActionSet(true),
        salesManagement: moduleActionSet(true),
        projectManagement: moduleActionSet(true),
        leadManagement: moduleActionSet(true),
        dealManagement: moduleActionSet(true),
        smsManagement: moduleActionSet(true),
        emailNotification: moduleActionSet(true),
        eventsManagement: moduleActionSet(true),
        zoomMeeting: moduleActionSet(true),
        supportDeskManagement: moduleActionSet(true)
    },
    Company: {
        subscription: moduleActionSet(false),
        crm: moduleActionSet(false),
        hrm: moduleActionSet(false),
        queryManagement: moduleActionSet(false),
        frontendManagement: moduleActionSet(false),
        productManagement: moduleActionSet(false),
        accounting: moduleActionSet(false),
        pos: moduleActionSet(false),
        salesManagement: moduleActionSet(false),
        projectManagement: moduleActionSet(false),
        leadManagement: moduleActionSet(false),
        dealManagement: moduleActionSet(false),
        smsManagement: moduleActionSet(false),
        emailNotification: moduleActionSet(false),
        eventsManagement: moduleActionSet(false),
        zoomMeeting: moduleActionSet(false),
        supportDeskManagement: moduleActionSet(false)
    },
    Employee: {
        subscription: moduleActionSet(false),
        crm: moduleActionSet(false),
        hrm: moduleActionSet(false),
        queryManagement: moduleActionSet(false),
        frontendManagement: moduleActionSet(false),
        productManagement: moduleActionSet(false),
        accounting: moduleActionSet(false),
        pos: moduleActionSet(false),
        salesManagement: moduleActionSet(false),
        projectManagement: moduleActionSet(false),
        leadManagement: moduleActionSet(false),
        dealManagement: moduleActionSet(false),
        smsManagement: moduleActionSet(false),
        emailNotification: moduleActionSet(false),
        eventsManagement: moduleActionSet(false),
        zoomMeeting: moduleActionSet(false),
        supportDeskManagement: moduleActionSet(false)
    },
    Customer: {
        subscription: moduleActionSet(false),
        crm: moduleActionSet(false),
        hrm: moduleActionSet(false),
        queryManagement: moduleActionSet(false),
        frontendManagement: moduleActionSet(false),
        productManagement: moduleActionSet(false),
        accounting: moduleActionSet(false),
        pos: moduleActionSet(false),
        salesManagement: moduleActionSet(false),
        projectManagement: moduleActionSet(false),
        leadManagement: moduleActionSet(false),
        dealManagement: moduleActionSet(false),
        smsManagement: moduleActionSet(false),
        emailNotification: moduleActionSet(false),
        eventsManagement: moduleActionSet(false),
        zoomMeeting: moduleActionSet(false),
        supportDeskManagement: moduleActionSet(false)
    },
    Vendor: {
        subscription: moduleActionSet(false),
        crm: moduleActionSet(false),
        hrm: moduleActionSet(false),
        queryManagement: moduleActionSet(false),
        frontendManagement: moduleActionSet(false),
        productManagement: moduleActionSet(false),
        accounting: moduleActionSet(false),
        pos: moduleActionSet(false),
        salesManagement: moduleActionSet(false),
        projectManagement: moduleActionSet(false),
        leadManagement: moduleActionSet(false),
        dealManagement: moduleActionSet(false),
        smsManagement: moduleActionSet(false),
        emailNotification: moduleActionSet(false),
        eventsManagement: moduleActionSet(false),
        zoomMeeting: moduleActionSet(false),
        supportDeskManagement: moduleActionSet(false)
    }
}

function toPermissionRoleKey(role) {
    const normalizedRole = normalizeRole(role)
    if (normalizedRole === "SuperAdmin") return "superadmin"
    if (normalizedRole === "Company") return "company"
    if (normalizedRole === "Customer") return "customer"
    if (normalizedRole === "Vendor") return "vendor"
    return "employee"
}

function getRoleKeyAliases(role) {
    const normalizedRole = normalizeRole(role)

    if (normalizedRole === "SuperAdmin") return ["superadmin", "SuperAdmin"]
    if (normalizedRole === "Company") return ["company", "Company", "ceo", "CEO", "manager", "Manager", "admin", "Admin", "hr", "HR"]
    if (normalizedRole === "Customer") return ["customer", "Customer", "client", "Client"]
    if (normalizedRole === "Vendor") return ["vendor", "Vendor", "vender", "Vender", "supplier", "Supplier"]
    return ["employee", "user", "teacher", "Employee", "User", "Teacher", "teacher"]
}

function cloneDefaultPermissions(defaultPermissions) {
    return JSON.parse(JSON.stringify(defaultPermissions))
}

function mergeModulePermissions(baseModulePermissions, incomingModulePermissions) {
    const merged = { ...baseModulePermissions }

    if (typeof incomingModulePermissions === "boolean") {
        return moduleActionSet(Boolean(incomingModulePermissions))
    }

    if (!incomingModulePermissions || typeof incomingModulePermissions !== "object") {
        return merged
    }

    for (const action of ACTION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(incomingModulePermissions, action)) {
            merged[action] = Boolean(incomingModulePermissions[action])
        }
    }
    return merged
}

async function getPermissionsForRole(role) {
    const normalizedRole = normalizeRole(role)
    const defaultPermissions = DEFAULT_PERMISSIONS[normalizedRole] || DEFAULT_PERMISSIONS.Employee

    if (normalizedRole === "SuperAdmin") {
        return cloneDefaultPermissions(defaultPermissions)
    }

    const roleAliases = getRoleKeyAliases(normalizedRole)
    const roleKey = toPermissionRoleKey(normalizedRole)
    const docs = await RolePermission.find({
        role: { $in: roleAliases }
    }).sort({ updatedAt: -1 }).lean()
    const doc =
        docs.find((d) => String(d.role).toLowerCase() === roleKey) ||
        docs.find((d) => String(d.role).toLowerCase() === normalizedRole.toLowerCase()) ||
        docs[0]
    if (!doc || !doc.permissions) {
        return cloneDefaultPermissions(defaultPermissions)
    }

    const merged = cloneDefaultPermissions(defaultPermissions)
    for (const moduleKey of PERMISSION_KEYS) {
        merged[moduleKey] = mergeModulePermissions(
            merged[moduleKey],
            doc.permissions[moduleKey]
        )
    }

    return merged
}

async function attachRolePermissions(req, res, next) {
    try {
        if (!req.session || !req.session.isAuth) {
            const guestPermissions = cloneDefaultPermissions(DEFAULT_PERMISSIONS.Employee)
            res.locals.modulePermissions = guestPermissions
            res.locals.canAccess = () => false
            res.locals.currentUserRole = "Employee"
            return next()
        }

        let role = normalizeRole(req.session.userRole)
        if (!req.session.userRole && req.session.email) {
            const dbUser = await authTable.findOne({ email: req.session.email }).lean()
            if (dbUser && dbUser.role) {
                role = normalizeRole(dbUser.role)
                req.session.userRole = role
            }
        }
        const permissions = await getPermissionsForRole(role)

        req.modulePermissions = permissions
        res.locals.modulePermissions = permissions
        res.locals.currentUserRole = role
        res.locals.canAccess = (moduleKey, action = "view") => {
            if (role === "SuperAdmin") return true
            return Boolean(
                permissions[moduleKey] &&
                permissions[moduleKey][action]
            )
        }
        return next()
    } catch (error) {
        console.error("Permission attach error:", error)
        const fallbackPermissions = cloneDefaultPermissions(DEFAULT_PERMISSIONS.Employee)
        res.locals.modulePermissions = fallbackPermissions
        res.locals.currentUserRole = "Employee"
        res.locals.canAccess = () => false
        return next()
    }
}

function hasAnyActionPermission(modulePermissions) {
    if (!modulePermissions || typeof modulePermissions !== "object") return false
    return ACTION_KEYS.some((action) => Boolean(modulePermissions[action]))
}

function sendAccessDenied(req, res, action, moduleKey) {
    const acceptHeader = String(req.headers.accept || "").toLowerCase()
    const wantsJson = req.xhr || acceptHeader.includes("application/json")
    const message = `Access denied for ${action} on ${MODULE_LABELS[moduleKey] || moduleKey}.`

    if (wantsJson) {
        return res.status(403).json({ success: false, message })
    }
    return res.status(403).render("Home/NoAccess.ejs", {
        moduleName: MODULE_LABELS[moduleKey] || moduleKey,
        actionName: action
    })
}

function requireModuleAccess(moduleKey, forcedAction) {
    return async (req, res, next) => {
        try {
            if (!req.session || !req.session.isAuth) {
                return res.redirect("/login")
            }

            let role = normalizeRole(req.session.userRole)
            if (!req.session.userRole && req.session.email) {
                const dbUser = await authTable.findOne({ email: req.session.email }).lean()
                if (dbUser && dbUser.role) {
                    role = normalizeRole(dbUser.role)
                    req.session.userRole = role
                }
            }
            if (role === "SuperAdmin") {
                return next()
            }

            const permissions = await getPermissionsForRole(role)
            const modulePermissions = permissions[moduleKey]
            const action = forcedAction || resolveActionFromRequest(req)

            if (modulePermissions && modulePermissions[action]) {
                return next()
            }

            // If any action is granted, allow list/view style access to avoid false-deny UX
            if (action === "view" && hasAnyActionPermission(modulePermissions)) {
                return next()
            }

            return sendAccessDenied(req, res, action, moduleKey)
        } catch (error) {
            console.error("Module permission error:", error)
            return res.status(500).send("Permission check failed.")
        }
    }
}

function resolveActionFromRequest(req) {
    const method = (req.method || "GET").toUpperCase()
    const path = String(req.path || "").toLowerCase()

    if (method === "DELETE") return "delete"
    if (method === "PUT" || method === "PATCH") return "edit"

    if (method === "POST") {
        if (path.includes("delete")) return "delete"
        if (
            path.includes("edit") ||
            path.includes("update") ||
            path.includes("status") ||
            path.includes("approve") ||
            path.includes("reject") ||
            path.includes("role") ||
            path.includes("reply") ||
            path.includes("send")
        ) {
            return "edit"
        }
        return "add"
    }

    if (method === "GET") {
        if (path.includes("table") || path.includes("list") || path.includes("dashboard")) {
            return "view"
        }
        if (path.includes("delete")) return "delete"
        if (
            path.includes("edit") ||
            path.includes("update") ||
            path.includes("status") ||
            path.includes("approve") ||
            path.includes("reject") ||
            path.includes("reply") ||
            path.includes("send")
        ) {
            return "edit"
        }
        // Opening pages/forms is treated as "view"; mutations are checked on POST/PUT/DELETE.
        if (path.includes("add") || path.includes("form") || path.includes("new")) {
            return "view"
        }
    }

    return "view"
}

module.exports = {
    PERMISSION_KEYS,
    ACTION_KEYS,
    MODULE_LABELS,
    DEFAULT_PERMISSIONS,
    toPermissionRoleKey,
    getPermissionsForRole,
    attachRolePermissions,
    requireModuleAccess
}
