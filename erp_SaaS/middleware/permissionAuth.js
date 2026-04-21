const RolePermission = require("../models/RolePermission")
const { normalizeRole, resolveRequestRole } = require("./roleAuth")

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

// Keep module availability configurable from permissions instead of hard-locking
// it by role. This preserves per-role dashboards without forcing modules off.
const MODULE_ROLE_RULES = {}

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
        subscription: moduleActionSet(true),
        crm: moduleActionSet(true),
        hrm: moduleActionSet(true),
        queryManagement: moduleActionSet(true),
        frontendManagement: moduleActionSet(false),
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
    Employee: {
        subscription: moduleActionSet(false),
        crm: moduleActionSet(true),
        hrm: moduleActionSet(true),
        queryManagement: moduleActionSet(true),
        frontendManagement: moduleActionSet(false),
        productManagement: moduleActionSet(true),
        accounting: moduleActionSet(true),
        pos: moduleActionSet(true),
        salesManagement: moduleActionSet(true),
        projectManagement: moduleActionSet(true),
        leadManagement: moduleActionSet(true),
        dealManagement: moduleActionSet(true),
        smsManagement: moduleActionSet(false),
        emailNotification: moduleActionSet(false),
        eventsManagement: moduleActionSet(true),
        zoomMeeting: moduleActionSet(true),
        supportDeskManagement: moduleActionSet(true)
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

function isModuleAllowedForRole(role, moduleKey) {
    const normalizedRole = normalizeRole(role)
    const allowedRoles = MODULE_ROLE_RULES[moduleKey]

    if (!Array.isArray(allowedRoles) || !allowedRoles.length) {
        return true
    }

    return allowedRoles.includes(normalizedRole)
}

function applyRoleModuleRules(role, permissions) {
    const maskedPermissions = cloneDefaultPermissions(permissions || {})

    for (const moduleKey of PERMISSION_KEYS) {
        if (!isModuleAllowedForRole(role, moduleKey)) {
            maskedPermissions[moduleKey] = moduleActionSet(false)
        } else if (!maskedPermissions[moduleKey]) {
            maskedPermissions[moduleKey] = moduleActionSet(false)
        }
    }

    return maskedPermissions
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
        return applyRoleModuleRules(normalizedRole, cloneDefaultPermissions(defaultPermissions))
    }

    const roleAliases = getRoleKeyAliases(normalizedRole)
    const roleKey = toPermissionRoleKey(normalizedRole)
    
    console.log(`[Permission Debug] Getting permissions for role: ${role} (normalized: ${normalizedRole}, key: ${roleKey})`)
    console.log(`[Permission Debug] Role aliases:`, roleAliases)
    
    const docs = await RolePermission.find({
        role: { $in: roleAliases }
    }).sort({ updatedAt: -1 }).lean()
    
    console.log(`[Permission Debug] Found ${docs.length} permission docs:`, docs.map(d => ({ role: d.role, updatedAt: d.updatedAt })))
    
    const doc =
        docs.find((d) => String(d.role).toLowerCase() === roleKey) ||
        docs.find((d) => String(d.role).toLowerCase() === normalizedRole.toLowerCase()) ||
        docs[0]
    
    console.log(`[Permission Debug] Selected doc:`, doc ? { role: doc.role, hasPermissions: !!doc.permissions } : null)
    
    if (!doc || !doc.permissions) {
        console.log(`[Permission Debug] No doc found, returning defaults`)
        return applyRoleModuleRules(normalizedRole, cloneDefaultPermissions(defaultPermissions))
    }

    const merged = cloneDefaultPermissions(defaultPermissions)
    for (const moduleKey of PERMISSION_KEYS) {
        merged[moduleKey] = mergeModulePermissions(
            merged[moduleKey],
            doc.permissions[moduleKey]
        )
    }

    return applyRoleModuleRules(normalizedRole, merged)
}

async function attachRolePermissions(req, res, next) {
    try {
        if (!req.session || !req.session.isAuth) {
            const guestPermissions = cloneDefaultPermissions(DEFAULT_PERMISSIONS.Employee)
            res.locals.modulePermissions = guestPermissions
            res.locals.canAccess = () => false
            res.locals.canAccessAny = () => false
            res.locals.currentUserRole = "Employee"
            return next()
        }

        const role = await resolveRequestRole(req)
        const permissions = await getPermissionsForRole(role)

        req.modulePermissions = permissions
        res.locals.modulePermissions = permissions
        res.locals.currentUserRole = role
        req.isModuleAllowedForRole = (moduleKey) => isModuleAllowedForRole(role, moduleKey)
        res.locals.isModuleAllowedForRole = req.isModuleAllowedForRole
        res.locals.canAccess = (moduleKey, action = "view") => {
            if (!isModuleAllowedForRole(role, moduleKey)) return false
            if (role === "SuperAdmin") return true
            return Boolean(
                permissions[moduleKey] &&
                permissions[moduleKey][action]
            )
        }
        res.locals.canAccessAny = (moduleKey, actions = ACTION_KEYS) => {
            if (!isModuleAllowedForRole(role, moduleKey)) return false
            if (role === "SuperAdmin") return true
            const modulePermissions = permissions[moduleKey]
            return Array.isArray(actions)
                ? actions.some((action) => Boolean(modulePermissions && modulePermissions[action]))
                : Boolean(modulePermissions && modulePermissions[actions])
        }
        return next()
    } catch (error) {
        console.error("Permission attach error:", error)
        const fallbackPermissions = cloneDefaultPermissions(DEFAULT_PERMISSIONS.Employee)
        res.locals.modulePermissions = fallbackPermissions
        res.locals.currentUserRole = "Employee"
        res.locals.canAccess = () => false
        res.locals.canAccessAny = () => false
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

            const role = await resolveRequestRole(req)
            console.log(`[Permission Debug] Checking access for role: ${role}, module: ${moduleKey}, session:`, req.session.email)

            if (!isModuleAllowedForRole(role, moduleKey)) {
                console.log(`[Permission Debug] Module ${moduleKey} is hidden for role ${role}`)
                return sendAccessDenied(req, res, forcedAction || resolveActionFromRequest(req), moduleKey)
            }
            
            if (role === "SuperAdmin") {
                return next()
            }

            const permissions = await getPermissionsForRole(role)
            const modulePermissions = permissions[moduleKey]
            const action = forcedAction || resolveActionFromRequest(req)
            
            console.log(`[Permission Debug] Module: ${moduleKey}, Action: ${action}`)
            console.log(`[Permission Debug] Module permissions:`, modulePermissions)
            console.log(`[Permission Debug] Has permission:`, modulePermissions ? modulePermissions[action] : 'N/A')

            if (modulePermissions && modulePermissions[action]) {
                return next()
            }

            // If any action is granted, allow list/view style access to avoid false-deny UX
            if (action === "view" && hasAnyActionPermission(modulePermissions)) {
                return next()
            }

            console.log(`[Permission Debug] Access DENIED for ${role} on ${moduleKey}:${action}`)
            return sendAccessDenied(req, res, action, moduleKey)
        } catch (error) {
            console.error("Module permission error:", error)
            return res.status(500).send("Permission check failed.")
        }
    }
}

function normalizeRoutePrefix(routePrefix) {
    const normalized = String(routePrefix || "").trim().toLowerCase()
    if (!normalized) return ""
    return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function requireScopedModuleAccess(moduleKey, routePrefixes, forcedAction) {
    const moduleGuard = requireModuleAccess(moduleKey, forcedAction)
    const prefixes = (Array.isArray(routePrefixes) ? routePrefixes : [routePrefixes])
        .map(normalizeRoutePrefix)
        .filter(Boolean)

    return (req, res, next) => {
        const requestPath = normalizeRoutePrefix(req.path || req.originalUrl || "")
        const shouldCheck = prefixes.some((prefix) => requestPath.startsWith(prefix))

        if (!shouldCheck) {
            return next()
        }

        return moduleGuard(req, res, next)
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
        if (path.includes("add") || path.includes("form") || path.includes("new")) {
            return "add"
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
    isModuleAllowedForRole,
    getPermissionsForRole,
    attachRolePermissions,
    requireModuleAccess,
    requireScopedModuleAccess
}
