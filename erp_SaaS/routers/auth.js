const router = require('express').Router()
const authTable = require('../models/auth')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const logincheck = require('../middleware/logincheck')

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
        req.session.userRole = Email.role

        // Role Based Redirect
        if (Email.role === "SuperAdmin") {
            return res.redirect("/dashboard")
        } else if (Email.role === "Admin") {
            return res.redirect("/dashboard")
        } else if (Email.role === "teacher") {
            return res.redirect("/dashboard")
        } else {
            return res.redirect("/")
        }

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
            role: "Admin"
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

router.get('/dashboard', async (req, res) => {
    // Check if user is logged in
    if (!req.session.isAuth) {
        return res.redirect('/login')
    }
    
    try {
        // Get full user data from database
        const user = await authTable.findOne({ email: req.session.email })
        
        if (!user) {
            return res.redirect('/login')
        }
        
        // Prepare user data for header
        const userData = {
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userRole: user.role,
            userInitial: user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U',
            userInitials: user.firstName && user.lastName ? 
                `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 
                (user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U')
        }
        
        res.render("Home/Dashboard.ejs", userData)
    } catch (error) {
        console.error('Dashboard error:', error)
        res.redirect('/login')
    }
})
router.get('/hproducts',(req,res)=>{
    res.render("Home/HProduct")
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
                res.locals.userRole = user.role
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