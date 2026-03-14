const router=require('express').Router()
const authTable=require('../models/auth')
const bannerTable=require('../models/Banner')
const AccountTable=require('../models/Accounting')
const bcrypt=require('bcrypt')
const nodemailer=require('nodemailer')
const logincheck=require('../middleware/logincheck')


router.get('/login',(req,res)=>{
    let mess=""
    res.render("Login.ejs",{mess})
})

router.post('/login', async (req, res) => {

    let mess = ""

    try {

        const { email, password } = req.body

        const Email = await authTable.findOne({ email: email })

        // ❌ Email not found
        if (!Email) {
            return res.render("Login.ejs", { 
                mess: "Wrong Username/Email" 
            })
        }

        const changepass = await bcrypt.compare(password, Email.password)

        // ❌ Password wrong
        if (!changepass) {
            return res.render("Login.ejs", { 
                mess: "Wrong Password" 
            })
        }

        // ❌ Account Suspended
        if (Email.status === "Suspended") {
            return res.render("Login.ejs", { 
                mess: "Your account has been suspended." 
            })
        }

        // ❌ Account not activated
        if (Email.status !== "Active") {
            return res.render("Login.ejs", { 
                mess: "Please activate your account from email first." 
            })
        }

        // ✅ Role Based Redirect
        if (Email.role === "SuperAdmin") {
            req.session.isAuth=true
            req.session.email=Email.email
            return res.redirect("/dashboard")
        } 
        else if (Email.role === "Admin") {
            return res.redirect("/dashboard")
        } 
        else if (Email.role === "teacher") {
            return res.redirect("/dashboard")   // typo fixed
        } 
        else {
            return res.redirect("/")
        }

    } catch (error) {
        return res.render("Login.ejs", { 
            mess: "Something went wrong" 
        })
    }

})
router.get('/accountActive/:id', async (req, res) => {
    try {
          const id = req.params.id
          await authTable.findByIdAndUpdate(id,{
          status:"Active"
        })
          res.render("accountActivated.ejs")
        } catch (error) {

        res.send("Activation failed")
       }
})

router.get('/register',(req,res)=>{
    let mess=""
    res.render("signup.ejs",{mess})
})

router.post('/register',async(req,res)=>{
    let mess = "" 
    try{
    const {firstname,lastname,email,password}=req.body
   if(!firstname || !lastname || !email || !password){
    throw new Error("all Input are not filled")
   }
    const EmailCheck=await authTable.findOne({email:email})
    if(EmailCheck){
        throw new Error(`${email}  Email-id Already Exist.`)
    }
    const cpass=await bcrypt.hash(password,10)
   const Record= await new authTable({firstName:firstname,lastName:lastname,email:email,password:cpass, status: "Inactive" })
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
   mess="Successfully Account Has been created"
}catch(error){
    mess=error.message
}
 res.render("signup.ejs",{mess})
})

router.get('/dashboard',(req,res)=>{
    const loginname=req.session.email
    res.render("Dashboard.ejs",{loginname})
})

router.get('/forgotpasswordform',(req,res)=>{
    let mess=""
    res.render("forgotpasswordForm.ejs",{mess})
})

router.post('/forgotpasswordform',async(req,res)=>{
    try{
    const {email}=req.body
    const emailCheck=await authTable.findOne({email:email})
    console.log(emailCheck)
    if(emailCheck){


        const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use true for port 465, false for port 587
  auth: {
    user: "swatis8102@gmail.com",
    pass: "bljvqtvbllernhdy",
  },
});

 const info = await transporter.sendMail({
    from: 'swatis8102@gmail.com',
    to: email,
    subject: "Hello ✔",
    text: "Hello world?", // Plain-text version of the message
    html: `<a href="http://localhost:5000/changepassword/${emailCheck.id}">Click to Forgot Password</a>`
  });
        mess="Password reset link has been sent to your registered email address successfully."
    }else{
        throw new Error("Email Not found!!")
    }
}catch(error){
    mess=error.message
}
    res.render("forgotpasswordForm.ejs",{mess})
})

router.get('/changepassword/:id',(req,res)=>{
    const mess=""
    res.render("newpasswordform.ejs",{mess})
})

router.post('/changepassword/:id',async(req,res)=>{
    let mess=""
    try{
    const {newpassword,conpassword}=req.body
    if(newpassword!=conpassword){
        throw new Error("Password Not match")
    }
    const id=req.params.id
    const changePass= await bcrypt.hash(newpassword,10)
    await authTable.findByIdAndUpdate(id,{password:changePass})
    mess="password change successfully"
    res.redirect('/successfullyLogin')
}catch(error){
    mess=error.message
    res.render("newpasswordform.ejs",{mess})

}
})
router.get('/successfullylogin', (req, res) => {
    res.render('successfullyLogin.ejs');
});


router.get('/logout',(req,res)=>{
    req.session.destroy()
    res.redirect('/login')
})


module.exports=router