const router=require('express').Router()
const upload=require('../middleware/multer')
const FeatureTable=require('../models/feature')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/featuretable',
    '/featureform',
    '/featurestatus',
    '/featuredelete',
    '/featureedit'
]))


router.get('/featuretable',async(req,res)=>{
    const featuredata=await  FeatureTable.find(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    })).sort({ updatedAt: -1, createdAt: -1 })
     const loginname=req.session.email
    res.render("Frontend/Feature/FeatureTable.ejs",{featuredata,loginname})
})

router.get('/featureform',(req,res)=>{
         const loginname=req.session.email

    res.render("Frontend/Feature/FeatureForm.ejs",{loginname})
})
router.post('/featureform',upload.single('img'),async(req,res)=>{
   const {title,desc}=req.body
   const imageFile=req.file.filename
   const Record=await FeatureTable({
    title:title,
    desc:desc,
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
   Record.save()
})

router.get('/featurestatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await FeatureTable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{status:newStatus})
    res.redirect("/featuretable")
     
})
 router.get('/featuredelete/:id',async(req,res)=>{
    const id=req.params.id
    await FeatureTable.findOneAndDelete(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
    res.redirect('/featuretable')
    
})
router.get('/featureedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await FeatureTable.findOne(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Feature/FeatureEdit.ejs",{Record,loginname})
})
router.post('/featureedit/:id',async(req,res)=>{
    const{title,desc}=req.body
    const id=req.params.id
    await FeatureTable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{title:title,desc:desc})
    
})



module.exports=router
