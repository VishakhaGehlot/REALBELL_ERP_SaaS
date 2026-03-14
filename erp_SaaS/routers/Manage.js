const router=require('express').Router()
const upload=require('../middleware/multer')
const managetable=require('../models/manage')

router.get('/managetable',async(req,res)=>{
    const managedata=await managetable.find()
     const loginname=req.session.email
    res.render("Managetable.ejs",{managedata, loginname})
})
router.get('/manageform',(req,res)=>{
    res.render("Manageform.ejs")
})
router.post('/manageform',upload.single('img'),async(req,res)=>{
const {title,desc}=req.body
const imageFile=req.file.filename
   const Record=await managetable({title:title,desc:desc,img:imageFile})
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
    await managetable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/managetable")
     
})
router.get('/managedelete/:id',async(req,res)=>{
    const id=req.params.id
    await managetable.findByIdAndDelete(id)
    res.redirect("/managetable")
})

router.get('/manageedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await managetable.findById(id)
    res.render("ManageEdit.ejs",{Record})
})
router.post('/manageedit/:id',async(req,res)=>{
    const {title,desc}=req.body
    const id=req.params.id
    await managetable.findByIdAndUpdate(id,{title:title,desc:desc})
    
})

module.exports=router