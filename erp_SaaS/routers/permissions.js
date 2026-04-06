const router = require("express").Router()
const RolePermission = require("../models/RolePermission")
const { requireAuth, allowRoles } = require("../middleware/roleAuth")
const {
    PERMISSION_KEYS,
    ACTION_KEYS,
    MODULE_LABELS,
    toPermissionRoleKey,
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
                permissions[moduleKey] = {}
                for (const action of ACTION_KEYS) {
                    permissions[moduleKey][action] = Boolean(modulePayload[action])
                }
            }

            await RolePermission.findOneAndUpdate(
                { role: toPermissionRoleKey(role) },
                { role: toPermissionRoleKey(role), permissions },
                { upsert: true, setDefaultsOnInsert: true }
            )
        }

        return res.redirect("/permissions?message=Permissions updated successfully")
    } catch (error) {
        console.error("Permissions save error:", error)
        return res.redirect("/permissions?message=Failed to update permissions")
    }
})

module.exports = router
