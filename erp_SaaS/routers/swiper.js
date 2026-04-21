const router=require('express').Router()
const upload=require('../middleware/multer')
const swipertable=require('../models/swiper')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/swipertable',
    '/swiperform',
    '/swiperstatus',
    '/swiperdelete'
]))

function buildSwiperScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        idFields: ['createdByUserId'],
        emailFields: ['createdByEmail']
    }, baseFilter)
}

router.get('/swipertable',async(req,res)=>{
    const swiperdata=await swipertable.find(buildSwiperScopeFilter(req))
    const loginname=req.session.email
    res.render("Frontend/Swiper/swipertable.ejs",{swiperdata,loginname})
})
router.get('/swiperform',(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Swiper/swiperform.ejs",{loginname})
})
router.post('/swiperform',upload.single('img'),async(req,res)=>{
const imageFile=req.file.filename
   const Record=await swipertable({
    img:imageFile,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
   })
   Record.save()
   
})

router.get('/swiperstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await swipertable.findOneAndUpdate(buildSwiperScopeFilter(req,{ _id:id }),{status:newStatus})
    res.redirect("/swipertable")
     
})
router.get('/swiperdelete/:id',async(req,res)=>{
    const id=req.params.id
    await swipertable.findOneAndDelete(buildSwiperScopeFilter(req,{ _id:id }))
    res.redirect("/swipertable")
})



module.exports=router
