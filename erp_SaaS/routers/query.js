const router=require('express').Router()
const querytable=require('../models/query')
const nodemailer=require('nodemailer')

router.get('/contact',(req,res)=>{
    res.render("contact.ejs")
})
router.post('/contact',async(req,res)=>{
    const {fname,lname,email,phone,moreDesc}=req.body
   const Record=await querytable({firstName:fname,lastName:lname,email,phone,message:moreDesc})
   Record.save()
   console.log(Record)
})

router.get('/querytable',async(req,res)=>{
    const querydata = await querytable.find().sort({ createdDate: 1 })
     const loginname=req.session.email
    res.render("querytable.ejs",{querydata, loginname})
})

router.get('/queryreplyform/:email/:message',(req,res)=>{
    const email=req.params.email
    const message=req.params.message
    const loginname=req.session.email
    res.render("queryform.ejs",{email,message,loginname})
})
router.post('/queryreplyform/:email/:message',async(req,res)=>{
    const {from,to,subject,message}=req.body
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
        from: from,
        to: to,
        subject: subject,
        text: message // Plain-text version of the message
      });
})

module.exports=router