const router=require('express').Router()
const upload=require('../middleware/multer')
const managetable=require('../models/manage')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/managetable',
    '/manageform',
    '/managestatus',
    '/managedelete',
    '/manageedit'
]))

function buildManageScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        idFields: ['createdByUserId'],
        emailFields: ['createdByEmail']
    }, baseFilter)
}

router.get('/managetable',async(req,res)=>{
    const managedata=await managetable.find(buildManageScopeFilter(req))
     const loginname=req.session.email
    res.render("Frontend/Manage/Managetable.ejs",{managedata, loginname})
})
router.get('/manageform',(req,res)=>{
    const loginname=req.session.email

    res.render("Frontend/Manage/Manageform.ejs",{loginname})
})
router.post('/manageform',upload.single('img'),async(req,res)=>{
const {title,desc}=req.body
const imageFile=req.file.filename
   const Record=await managetable({
    title:title,
    desc:desc,
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
   Record.save()
})

router.get('/managestatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await managetable.findOneAndUpdate(buildManageScopeFilter(req,{ _id:id }),{status:newStatus})
    res.redirect("/managetable")
     
})
router.get('/managedelete/:id',async(req,res)=>{
    const id=req.params.id
    await managetable.findOneAndDelete(buildManageScopeFilter(req,{ _id:id }))
    res.redirect("/managetable")
})

router.get('/manageedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await managetable.findOne(buildManageScopeFilter(req,{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Manage/ManageEdit.ejs",{Record,loginname})
})
router.post('/manageedit/:id',async(req,res)=>{
    const {title,desc}=req.body
    const id=req.params.id
    await managetable.findOneAndUpdate(buildManageScopeFilter(req,{ _id:id }),{title:title,desc:desc})
    
})

module.exports=router
