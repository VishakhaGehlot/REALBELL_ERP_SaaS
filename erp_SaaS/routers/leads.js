const router=require('express').Router()
const upload=require('../middleware/multer')
const leadstable=require('../models/leads')
const { requireAuth } = require('../middleware/roleAuth')
const { requireModuleAccess } = require('../middleware/permissionAuth')

router.use(requireAuth)
router.use(requireModuleAccess('frontendManagement'))

router.get('/leadstable',async(req,res)=>{
    const leadsdata=await leadstable.find()
     const loginname=req.session.email
    res.render("Frontend/Lead/leadstable.ejs",{leadsdata, loginname})
})
router.get('/leadsform',(req,res)=>{
    const loginname=req.session.email

    res.render("Frontend/Lead/leadsform.ejs",{loginname})
})
router.post('/leadsform',upload.single('img'),async(req,res)=>{
const {title,desc}=req.body
const imageFile=req.file.filename
   const Record=await leadstable({title:title,desc:desc,img:imageFile})
   Record.save()
})

router.get('/leadsstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await leadstable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/leadstable")
     
})
router.get('/leadsdelete/:id',async(req,res)=>{
    const id=req.params.id
    await leadstable.findByIdAndDelete(id)
    res.redirect("/leadstable")
})

router.get('/leadsedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await leadstable.findById(id)
         const loginname=req.session.email

    res.render("Frontend/Lead/leadsEdit.ejs",{Record,loginname})
})
router.post('/leadsedit/:id',async(req,res)=>{
    const {title,desc}=req.body
    const id=req.params.id
    await leadstable.findByIdAndUpdate(id,{title:title,desc:desc})
    
})

module.exports=router
