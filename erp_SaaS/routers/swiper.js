const router=require('express').Router()
const upload=require('../middleware/multer')
const swipertable=require('../models/swiper')

router.get('/swipertable',async(req,res)=>{
    const swiperdata=await swipertable.find()
    const loginname=req.session.email
    res.render("Frontend/Swiper/swipertable.ejs",{swiperdata,loginname})
})
router.get('/swiperform',(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Swiper/swiperform.ejs",{loginname})
})
router.post('/swiperform',upload.single('img'),async(req,res)=>{
const imageFile=req.file.filename
   const Record=await swipertable({img:imageFile})
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
    await swipertable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/swipertable")
     
})
router.get('/swiperdelete/:id',async(req,res)=>{
    const id=req.params.id
    await swipertable.findByIdAndDelete(id)
    res.redirect("/swipertable")
})



module.exports=router