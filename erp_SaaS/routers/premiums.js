const router=require('express').Router()
const upload=require('../middleware/multer')
const premiumstable=require('../models/premiums')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/premiumstable',
    '/premiumsform',
    '/premiumsstatus',
    '/premiumsdelete',
    '/premiumsedit'
]))

function buildPremiumScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        idFields: ['createdByUserId'],
        emailFields: ['createdByEmail']
    }, baseFilter)
}

router.get('/premiumstable',async(req,res)=>{
    const premiumsdata=await premiumstable.find(buildPremiumScopeFilter(req))
     const loginname=req.session.email
    res.render("Frontend/Premium/premiumstable.ejs",{premiumsdata, loginname})
})
router.get('/premiumsform',(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Premium/premiumsform.ejs",{loginname})
})
router.post('/premiumsform',upload.single('img'),async(req,res)=>{
const {title}=req.body
const imageFile=req.file.filename
   const Record=await premiumstable({
    title:title,
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
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
    await premiumstable.findOneAndUpdate(buildPremiumScopeFilter(req,{ _id:id }),{status:newStatus})
    res.redirect("/premiumstable")
     
})
router.get('/premiumsdelete/:id',async(req,res)=>{
    const id=req.params.id
    await premiumstable.findOneAndDelete(buildPremiumScopeFilter(req,{ _id:id }))
    res.redirect("/premiumstable")
})

router.get('/premiumsedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await premiumstable.findOne(buildPremiumScopeFilter(req,{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Premium/premiumsEdit.ejs",{Record,loginname})
})
router.post('/premiumsedit/:id',async(req,res)=>{
    const {title}=req.body
    const id=req.params.id
    await premiumstable.findOneAndUpdate(buildPremiumScopeFilter(req,{ _id:id }),{title:title})
    
})

module.exports=router
