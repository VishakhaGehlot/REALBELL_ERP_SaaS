const router=require('express').Router()
const upload=require('../middleware/multer')
const accountTable=require('../models/Accounting')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/accounttable',
    '/accountform',
    '/accountstatus',
    '/accountdelete',
    '/accountedit'
]))


router.get('/accounttable',async(req,res)=>{
    const data=await accountTable.find(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    }))
     const loginname=req.session.email
    res.render("Frontend/Account/AccountingTable.ejs",{data,loginname})
})

router.get('/accountform',(req,res)=>{
         const loginname=req.session.email

    res.render("Frontend/Account/AccountingForm.ejs",{loginname})
})
router.post('/accountform',upload.single('img'),async(req,res)=>{
   const {title,desc}=req.body
   const imageFile=req.file ? req.file.filename : ""
   const Record=await accountTable({
    title:title,
    desc:desc,
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
   Record.save()
})

router.get('/accountstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await accountTable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{status:newStatus})
    res.redirect("/accounttable")
     
})
 router.get('/accountdelete/:id',async(req,res)=>{
    const id=req.params.id
    await accountTable.findOneAndDelete(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
    res.redirect('/accounttable')
    
})
router.get('/accountedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await accountTable.findOne(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Account/AccountEdit.ejs",{Record,loginname})
})
router.post('/accountedit/:id',async(req,res)=>{
    const{title,desc}=req.body
    const id=req.params.id
    await accountTable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{title:title,desc:desc})
    
})



module.exports=router
