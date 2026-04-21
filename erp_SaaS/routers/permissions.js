const router = require("express").Router()
const RolePermission = require("../models/RolePermission")
const { requireAuth, allowRoles } = require("../middleware/roleAuth")
const {
    PERMISSION_KEYS,
    ACTION_KEYS,
    MODULE_LABELS,
    toPermissionRoleKey,
    isModuleAllowedForRole,
    getPermissionsForRole
} = require("../middleware/permissionAuth")

const MANAGEABLE_ROLES = ["SuperAdmin", "Company", "Employee", "Customer", "Vendor"]

router.use(requireAuth)
router.use(allowRoles("SuperAdmin"))

router.get("/permissions", async (req, res) => {
    try {
        const map = {}

        for (const role of MANAGEABLE_ROLES) {
            map[role] = await getPermissionsForRole(role)
        }

        return res.render("UserManage/permissions.ejs", {
            permissionsByRole: map,
            roles: MANAGEABLE_ROLES,
            permissionKeys: PERMISSION_KEYS,
            actionKeys: ACTION_KEYS,
            moduleLabels: MODULE_LABELS,
            isModuleAllowedForRole,
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("Permissions page error:", error)
        return res.status(500).send("Unable to load permissions page.")
    }
})

router.post("/permissions", async (req, res) => {
    try {
        const submitted = req.body.permissions || {}

        for (const role of MANAGEABLE_ROLES) {
            const rolePayload = submitted[role] || {}
            const permissions = {}

            for (const moduleKey of PERMISSION_KEYS) {
                const modulePayload = rolePayload[moduleKey] || {}
                const moduleAllowedForRole = isModuleAllowedForRole(role, moduleKey)
                permissions[moduleKey] = {}
                for (const action of ACTION_KEYS) {
                    permissions[moduleKey][action] = moduleAllowedForRole && Boolean(modulePayload[action])
                }
            }

            const roleKey = toPermissionRoleKey(role)
            console.log(`[Permissions Save] Saving permissions for role: ${role} -> key: ${roleKey}`)
            
            await RolePermission.findOneAndUpdate(
                { role: roleKey },
                { $set: { permissions } },
                { upsert: true, setDefaultsOnInsert: true, new: true }
            )
            
            console.log(`[Permissions Save] Saved for ${roleKey}`)
        }

        return res.redirect("/permissions?message=Permissions updated successfully")
    } catch (error) {
        console.error("Permissions save error:", error)
        return res.redirect("/permissions?message=Failed to update permissions")
    }
})

// Debug API to check permissions (for troubleshooting)
router.get("/api/debug/permissions", requireAuth, async (req, res) => {
    try {
        const role = req.query.role || req.session.userRole || "Employee"
        const rawDocs = await RolePermission.find().lean()
        const computed = await getPermissionsForRole(role)
        
        res.json({
            requestedRole: role,
            sessionRole: req.session.userRole,
            sessionEmail: req.session.email,
            rawDatabaseDocs: rawDocs.map(d => ({ role: d.role, perms: d.permissions })),
            computedPermissions: computed
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

module.exports = router
