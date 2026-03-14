const router=require('express').Router()
const faqtable=require('../models/faq')


router.get("/faqtable",async(req,res)=>{
    const loginname=req.session.email
    const faqdata=await faqtable.find()
    res.render("FaqTable.ejs",{faqdata,loginname})
})
router.get("/faqform",(req,res)=>{
    res.render("FaqForm.ejs")
})

router.post("/faqform",async(req,res)=>{
const {title,desc}=req.body
   const record=await faqtable({title:title,desc:desc})
   record.save()
})
 router.get('/faqstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await faqtable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/faqtable")
 })

router.get('/faqdelete/:id',async(req,res)=>{
    const id=req.params.id
    await faqtable.findByIdAndDelete(id)
    res.redirect("/faqtable")
})

router.get('/faqedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await faqtable.findById(id)
    res.render("faqedit.ejs",{Record})
})
router.post('/faqedit/:id',async(req,res)=>{
    const {title,desc}=req.body
    const id=req.params.id
    await faqtable.findByIdAndUpdate(id,{title:title,desc:desc})
    // res.redirect("/bannertable")
})

module.exports=router