const router=require('express').Router()
const faqtable=require('../models/faq')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/faqtable',
    '/faqform',
    '/faqstatus',
    '/faqdelete',
    '/faqedit'
]))


router.get("/faqtable",async(req,res)=>{
    const loginname=req.session.email
    const faqdata=await faqtable.find(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    })).sort({ updatedAt: -1, createdAt: -1 })
    res.render("Frontend/Faq/FaqTable.ejs",{faqdata,loginname})
})
router.get("/faqform",(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Faq/FaqForm.ejs",{loginname})
})

router.post("/faqform",async(req,res)=>{
const {title,desc}=req.body
   const record=await faqtable({
    title:title,
    desc:desc,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
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
    await faqtable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{status:newStatus})
    res.redirect("/faqtable")
 })

router.get('/faqdelete/:id',async(req,res)=>{
    const id=req.params.id
    await faqtable.findOneAndDelete(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
    res.redirect("/faqtable")
})

router.get('/faqedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await faqtable.findOne(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Faq/faqedit.ejs",{Record,loginname})
})
router.post('/faqedit/:id',async(req,res)=>{
    const {title,desc}=req.body
    const id=req.params.id
    await faqtable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{title:title,desc:desc})
    // res.redirect("/bannertable")
})

module.exports=router
