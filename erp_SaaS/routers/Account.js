const router=require('express').Router()
const upload=require('../middleware/multer')
const accountTable=require('../models/Accounting')


router.get('/accounttable',async(req,res)=>{
    const data=await accountTable.find()
     const loginname=req.session.email
    res.render("AccountingTable.ejs",{data,loginname})
})

router.get('/accountform',(req,res)=>{
    res.render("AccountingForm.ejs")
})
router.post('/accountform',upload.single('img'),async(req,res)=>{
   const {title,desc}=req.body
   const imageFile=req.file.filename
   const Record=await accountTable({title:title,desc:desc,img:imageFile})
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
    await accountTable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/accounttable")
     
})
 router.get('/accountdelete/:id',async(req,res)=>{
    const id=req.params.id
    await accountTable.findByIdAndDelete(id)
    res.redirect('/accounttable')
    
})
router.get('/accountedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await accountTable.findById(id)
    res.render("AccountEdit.ejs",{Record})
})
router.post('/accountedit/:id',async(req,res)=>{
    const{title,desc}=req.body
    const id=req.params.id
    await accountTable.findByIdAndUpdate(id,{title:title,desc,desc})
    
})



module.exports=router