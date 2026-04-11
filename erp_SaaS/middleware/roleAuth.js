const authTable = require("../models/auth")

function normalizeRole(role) {
    if (!role) return "Employee"

    const value = String(role).trim().toLowerCase()
    if (value === "superadmin" || value === "super_admin") return "SuperAdmin"
    if (value === "company" || value === "organisation" || value === "organization" || value === "ceo" || value === "manager" || value === "admin" || value === "hr") return "Company"
    if (value === "customer" || value === "client") return "Customer"
    if (value === "vendor" || value === "vender" || value === "supplier") return "Vendor"
    if (value === "teacher" || value === "user" || value === "employee" || value === "staff") return "Employee"
    return "Employee"
}

async function resolveRequestRole(req) {
    let role = normalizeRole(req.session && req.session.userRole)

    if (!req.session || !req.session.email) {
        return role
    }

    try {
        const dbUser = await authTable.findOne({ email: req.session.email }, { role: 1 }).lean()
        if (dbUser && dbUser.role) {
            const dbRole = normalizeRole(dbUser.role)
            if (req.session.userRole !== dbRole) {
                req.session.userRole = dbRole
            }
            role = dbRole
        }
    } catch (error) {
        console.error("Role resolve error:", error)
    }

    return role
}

function requireAuth(req, res, next) {
    if (req.session && req.session.isAuth) {
        return next()
    }
    return res.redirect("/login")
}

function allowRoles(...allowedRoles) {
    const normalizedAllowed = allowedRoles.map(normalizeRole)

    return async (req, res, next) => {
        try {
            const currentRole = await resolveRequestRole(req)
    
            const hasRoleAccess = normalizedAllowed.includes(currentRole)

            if (hasRoleAccess) {
                return next()
            }
            return res.status(403).render("Home/NoAccess.ejs", {
                moduleName: "Restricted Area",
                actionName: "access"
            })
        } catch (error) {
            console.error("Role middleware error:", error)
            return res.status(500).send("Permission check failed.")
        }
    }
}

module.exports = {
    normalizeRole,
    resolveRequestRole,
    requireAuth,
    allowRoles
}
