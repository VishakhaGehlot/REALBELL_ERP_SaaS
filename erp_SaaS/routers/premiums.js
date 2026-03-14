const router=require('express').Router()
const upload=require('../middleware/multer')
const premiumstable=require('../models/premiums')

router.get('/premiumstable',async(req,res)=>{
    const premiumsdata=await premiumstable.find()
     const loginname=req.session.email
    res.render("premiumstable.ejs",{premiumsdata, loginname})
})
router.get('/premiumsform',(req,res)=>{
    res.render("premiumsform.ejs")
})
router.post('/premiumsform',upload.single('img'),async(req,res)=>{
const {title}=req.body
const imageFile=req.file.filename
   const Record=await premiumstable({title:title,img:imageFile})
   Record.save()
})

router.get('/premiumsstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await premiumstable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/premiumstable")
     
})
router.get('/premiumsdelete/:id',async(req,res)=>{
    const id=req.params.id
    await leadstable.findByIdAndDelete(id)
    res.redirect("/premiumstable")
})

router.get('/premiumsedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await premiumstable.findById(id)
    res.render("premiumsEdit.ejs",{Record})
})
router.post('/premiumsedit/:id',async(req,res)=>{
    const {title}=req.body
    const id=req.params.id
    await premiumstable.findByIdAndUpdate(id,{title:title})
    
})

module.exports=router