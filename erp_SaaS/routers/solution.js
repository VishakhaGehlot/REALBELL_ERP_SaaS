const router=require('express').Router()
const upload=require('../middleware/multer')
const solutiontable=require('../models/solution')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/solutiontable',
    '/solutionform',
    '/solutionstatus',
    '/solutiondelete',
    '/solutionedit'
]))

router.get('/solutiontable',async(req,res)=>{
    const solutiondata=await solutiontable.find(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    })).sort({ updatedAt: -1, createdAt: -1 })
     const loginname=req.session.email
    res.render("Frontend/Solution/solutiontable.ejs",{solutiondata,loginname})
})
router.get('/solutionform',(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Solution/solutionform.ejs",{loginname})
})
router.post('/solutionform',upload.single('img'),async(req,res)=>{
const {title,desc,mdesc}=req.body
const imageFile=req.file.filename
   const Record=await solutiontable({
    title:title,
    desc:desc,
    mdesc:mdesc,
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
   Record.save()
})

router.get('/solutionstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await solutiontable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{status:newStatus})
    res.redirect("/solutiontable")
     
})
router.get('/solutiondelete/:id',async(req,res)=>{
    const id=req.params.id
    await solutiontable.findOneAndDelete(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
    res.redirect("/solutiontable")
})

router.get('/solutionedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await solutiontable.findOne(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Solution/solutionEdit.ejs",{Record,loginname})
})
router.post('/solutionedit/:id',async(req,res)=>{
    const {title,desc,mdesc}=req.body
    const id=req.params.id
    await solutiontable.findOneAndUpdate(buildOwnedDocumentFilter(req,{
        idFields:['createdByUserId'],
        emailFields:['createdByEmail']
    },{ _id:id }),{title:title,desc:desc,mdesc:mdesc})
    
})

module.exports=router
