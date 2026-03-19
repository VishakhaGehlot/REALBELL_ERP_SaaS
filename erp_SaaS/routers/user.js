const router = require('express').Router()
const usertable = require('../models/auth')
const bcrypt = require('bcrypt')

// ================= GET ALL USERS =================
router.get("/usertable", async (req, res) => {
    const userdata = await usertable.find()
    const loginname = req.session.email
    res.render("usertable.ejs", { userdata, loginname })
})

// ================= FORM =================
router.get("/userform", (req, res) => {
    const loginname = req.session.email
    res.render("userform.ejs", { loginname })
})

// ================= CREATE USER (bcrypt added) =================
router.post("/userform", async (req, res) => {
    try {
        const { firstName, lastName, email, role, password } = req.body

        // 🔐 HASH PASSWORD
        const hashPassword = await bcrypt.hash(password, 10)

        const record = new usertable({
            firstName,
            lastName,
            email,
            role,
            password: hashPassword
        })

        await record.save()

        res.redirect("/usertable")

    } catch (error) {
        res.send(error.message)
    }
})

// ================= DELETE =================
router.get('/userdelete/:id', async (req, res) => {
    const id = req.params.id
    await usertable.findByIdAndDelete(id)
    res.redirect("/usertable")
})

// ================= EDIT FORM =================
router.get('/useredit/:id', async (req, res) => {
    const id = req.params.id
    const Record = await usertable.findById(id)
    const loginname = req.session.email

    res.render("useredit.ejs", { Record, loginname })
})

// ================= UPDATE (NO PASSWORD CHANGE HERE) =================
router.post('/useredit/:id', async (req, res) => {
    const { firstName, lastName, email, role } = req.body
    const id = req.params.id

    await usertable.findByIdAndUpdate(id, {
        firstName,
        lastName,
        email,
        role
    })

    res.redirect("/usertable")
})

// ================= STATUS =================
router.get('/userstatus/:id/:status', async (req, res) => {
    const id = req.params.id
    const currentStatus = req.params.status

    let newStatus = currentStatus == "Pending" ? "Active" : "Pending"

    await usertable.findByIdAndUpdate(id, { status: newStatus })

    res.redirect("/usertable")
})

// ================= ROLE =================
router.post('/userrole/:id', async (req, res) => {
    const { role } = req.body
    const id = req.params.id

    await usertable.findByIdAndUpdate(id, { role })

    res.redirect("/usertable")
})

module.exports = router