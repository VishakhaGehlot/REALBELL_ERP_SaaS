const router=require('express').Router()
const bannerTable=require('../models/Banner')

router.get('/bannertable',async(req,res)=>{
    const data=await bannerTable.find()
    const loginname=req.session.email
    res.render("BannerTable.ejs",{data,loginname})
})


router.get('/bannerform',(req,res)=>{
    const loginname=req.session.email
    res.render("BannerForm.ejs",{loginname})
})

router.post('/bannerform',async(req,res)=>{
    const {title,desc,mdesc}=req.body
  const Record= await  new bannerTable({title:title,desc:desc,mdesc:mdesc})
  Record.save()
  console.log(Record)
})
router.get('/bannerdelete/:id',async(req,res)=>{
    const id=req.params.id
    await bannerTable.findByIdAndDelete(id)
    res.redirect("/bannertable")
})

router.get('/banneredit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await bannerTable.findById(id)
    res.render("BannerEdit.ejs",{Record})
})
router.post('/banneredit/:id',async(req,res)=>{
    const {title,desc,mdesc}=req.body
    const id=req.params.id
    await bannerTable.findByIdAndUpdate(id,{title:title,desc:desc,mdesc:mdesc})
    // res.redirect("/bannertable")
})

router.get('/statusupdate/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await bannerTable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect('/bannertable')

})
module.exports=router