const router = require("express").Router()
const usertable = require("../models/auth")
const bcrypt = require("bcrypt")
const { requireAuth, allowRoles } = require("../middleware/roleAuth")

const superAdminOnly = [requireAuth, allowRoles("SuperAdmin")]
const reportingManagerRoles = ["SuperAdmin", "CEO", "Admin", "Manager", "HR"]

async function getManagerOptions(excludeId) {
    const query = { role: { $in: reportingManagerRoles } }
    if (excludeId) query._id = { $ne: excludeId }

    return usertable
        .find(query, { firstName: 1, lastName: 1, email: 1, role: 1 })
        .sort({ firstName: 1, lastName: 1 })
        .lean()
}

function resolveReportsTo(reportsTo) {
    if (!reportsTo || reportsTo === "none" || reportsTo === "null") return null
    return reportsTo
}

function sanitizeRole(role) {
    const cleaned = String(role || "").trim()
    if (!cleaned) return "Employee"
    return cleaned.slice(0, 50)
}

// ================= GET ALL USERS =================
router.get("/usertable", ...superAdminOnly, async (req, res) => {
    const userdata = await usertable
        .find()
        .populate("reportsTo", "firstName lastName email role")
        .sort({ firstName: 1, lastName: 1 })
    const loginname = req.session.email
    res.render("UserManage/usertable.ejs", { userdata, loginname })
})

// ================= FORM =================
router.get("/userform", ...superAdminOnly, async (req, res) => {
    const loginname = req.session.email
    const managerOptions = await getManagerOptions()
    res.render("UserManage/userform.ejs", { loginname, managerOptions })
})

// ================= CREATE USER (bcrypt added) =================
router.post("/userform", ...superAdminOnly, async (req, res) => {
    try {
        const { firstName, lastName, email, role, password, mobile, dob, reportsTo } = req.body

        if (!firstName || !lastName || !email || !password || !mobile || !dob) {
            throw new Error("All user fields are required.")
        }

        const normalizedEmail = email.trim().toLowerCase()
        const emailExists = await usertable.findOne({ email: normalizedEmail })
        if (emailExists) {
            throw new Error("Email already exists.")
        }

        // 🔐 HASH PASSWORD
        const hashPassword = await bcrypt.hash(password, 10)

        const record = new usertable({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            role: sanitizeRole(role),
            password: hashPassword,
            mobile: mobile.trim(),
            dob,
            reportsTo: resolveReportsTo(reportsTo),
            status: "Active"
        })

        await record.save()

        res.redirect("/usertable")

    } catch (error) {
        res.send(error.message)
    }
})

// ================= DELETE =================
router.get('/userdelete/:id', ...superAdminOnly, async (req, res) => {
    const id = req.params.id
    await usertable.findByIdAndDelete(id)
    await usertable.updateMany({ reportsTo: id }, { $set: { reportsTo: null } })
    res.redirect("/usertable")
})

// ================= EDIT FORM =================
router.get('/useredit/:id', ...superAdminOnly, async (req, res) => {
    const id = req.params.id
    const Record = await usertable.findById(id)
    const managerOptions = await getManagerOptions(id)
    const loginname = req.session.email

    res.render("UserManage/useredit.ejs", { Record, loginname, managerOptions })
})

// ================= UPDATE (NO PASSWORD CHANGE HERE) =================
router.post('/useredit/:id', ...superAdminOnly, async (req, res) => {
    const { firstName, lastName, email, role, mobile, dob, status, reportsTo } = req.body
    const id = req.params.id

    const updateData = {
        role: sanitizeRole(role),
        reportsTo: resolveReportsTo(reportsTo)
    }

    if (firstName) updateData.firstName = firstName.trim()
    if (lastName) updateData.lastName = lastName.trim()
    if (email) updateData.email = email.trim().toLowerCase()
    if (mobile) updateData.mobile = mobile.trim()
    if (dob) updateData.dob = dob
    if (status) updateData.status = status

    await usertable.findByIdAndUpdate(id, updateData)

    res.redirect("/usertable")
})

// ================= STATUS =================
router.get('/userstatus/:id/:status', ...superAdminOnly, async (req, res) => {
    const id = req.params.id
    const currentStatus = req.params.status

    let newStatus = currentStatus == "Active" ? "Inactive" : "Active"

    await usertable.findByIdAndUpdate(id, { status: newStatus })

    res.redirect("/usertable")
})

// ================= ROLE =================
router.post('/userrole/:id', ...superAdminOnly, async (req, res) => {
    const { role } = req.body
    const id = req.params.id

    await usertable.findByIdAndUpdate(id, { role: sanitizeRole(role) })

    res.redirect("/usertable")
})

module.exports = router
