const router = require('express').Router()
const authTable = require('../models/auth')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const logincheck = require('../middleware/logincheck')
const { normalizeRole, requireAuth } = require('../middleware/roleAuth')
const queryTable = require('../models/query')

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
        // Get full user data from database
        const user = await authTable.findOne({ email: req.session.email })
        
        if (!user) {
            return res.redirect('/login')
        }

        const role = normalizeRole(user.role)
        
        // Prepare user data for header
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
            const allUsersRaw = await authTable.find().sort({ firstName: 1, lastName: 1 })
            const allUsers = allUsersRaw.map((u) => ({
                ...u.toObject(),
                role: normalizeRole(u.role)
            }))
            const stats = {
                totalUsers: allUsers.length,
                activeUsers: allUsers.filter(u => u.status === "Active").length,
                leadershipUsers: allUsers.filter((u) => {
                    return u.role === "SuperAdmin" || u.role === "CEO" || u.role === "Admin" || u.role === "Manager"
                }).length,
                employeeUsers: allUsers.filter((u) => u.role === "Employee").length
            }

            return res.render("Home/SuperAdminDashboard.ejs", {
                ...userData,
                allUsers,
                stats
            })
        }

        const totalQueries = await queryTable.countDocuments()
        const repliedQueries = await queryTable.countDocuments({ replied: true })
        const totalUsers = await authTable.countDocuments()
        const activeUsers = await authTable.countDocuments({ status: "Active" })

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setHours(0, 0, 0, 0)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

        const weekDayLabels = []
        const dayKeys = []
        for (let i = 0; i < 7; i += 1) {
            const day = new Date(sevenDaysAgo)
            day.setDate(sevenDaysAgo.getDate() + i)
            weekDayLabels.push(day.toLocaleDateString('en-US', { weekday: 'short' }))
            dayKeys.push(day.toISOString().slice(0, 10))
        }

        const queriesLastWeek = await queryTable.find(
            { createdDate: { $gte: sevenDaysAgo } },
            { createdDate: 1 }
        ).lean()
        const queryCountByDay = Object.fromEntries(dayKeys.map((key) => [key, 0]))
        queriesLastWeek.forEach((q) => {
            const key = new Date(q.createdDate || Date.now()).toISOString().slice(0, 10)
            if (Object.prototype.hasOwnProperty.call(queryCountByDay, key)) {
                queryCountByDay[key] += 1
            }
        })
        const queryStats = dayKeys.map((key) => queryCountByDay[key] || 0)

        const usersForChart = await authTable.find({}, { _id: 1, status: 1 }).lean()
        const userCountByDay = Object.fromEntries(dayKeys.map((key) => [key, 0]))
        usersForChart.forEach((u) => {
            const createdAt = u._id && typeof u._id.getTimestamp === 'function'
                ? u._id.getTimestamp()
                : new Date()
            const key = new Date(createdAt).toISOString().slice(0, 10)
            if (Object.prototype.hasOwnProperty.call(userCountByDay, key)) {
                userCountByDay[key] += 1
            }
        })
        const userStats = dayKeys.map((key) => userCountByDay[key] || 0)

        const recentQueriesRaw = await queryTable
            .find({}, { firstName: 1, lastName: 1, message: 1, createdDate: 1, replied: 1 })
            .sort({ createdDate: -1 })
            .limit(5)
            .lean()

        const recentQueries = recentQueriesRaw.map((q) => {
            const msg = (q.message || '').trim()
            const fallbackName = `${(q.firstName || '').trim()} ${(q.lastName || '').trim()}`.trim() || 'User'
            const shortTitle = msg ? msg.slice(0, 80) : `Query from ${fallbackName}`
            return {
                title: shortTitle,
                status: q.replied ? 'replied' : 'pending',
                createdAt: q.createdDate || new Date()
            }
        })

        const recentUsersRaw = await authTable
            .find({}, { firstName: 1, lastName: 1, email: 1, status: 1, _id: 1 })
            .sort({ _id: -1 })
            .limit(5)
            .lean()

        const recentUsers = recentUsersRaw.map((u) => {
            const createdAt = u._id && typeof u._id.getTimestamp === 'function'
                ? u._id.getTimestamp()
                : new Date()
            return {
                name: `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim() || 'User',
                email: u.email || '-',
                status: u.status === 'Active' ? 'active' : 'pending',
                createdAt
            }
        })

        return res.render("Home/Dashboard.ejs", {
            ...userData,
            dashboardStats: {
                totalQueries,
                repliedQueries,
                totalUsers,
                activeNow: activeUsers
            },
            dashboardData: {
                queryStats,
                userStats,
                dayLabels: weekDayLabels,
                recentQueries,
                recentUsers
            }
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
