const router=require('express').Router()
const authTable=require('../models/auth')
const authC=require('../controllers/authcontroller')

const nodemailer=require('nodemailer')
const logincheck=require('../middleware/logincheck')


router.get('/login',authC.login)

router.post('/login',authC.loginform)
router.get('/accountActive/:id',authC.accountActive )

router.get('/register',authC.register)

router.post('/register',authC.registerform)

router.get('/dashboard',authC.dashboard)



// ================= GET =================
router.get('/forgotpasswordform',authC.forgotpassword)

// ================= POST =================
router.post('/forgotpasswordform',authC.forgotpasswordform )

router.get('/changepassword/:id',authC.changepassword)

router.post('/changepassword/:id',authC.changepasswordform)
router.get('/successfullylogin',authC.successfullylogin);


router.get('/logout',authC.logout)


module.exports=router