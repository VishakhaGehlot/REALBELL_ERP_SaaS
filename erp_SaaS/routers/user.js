const router=require('express').Router()
const usertable=require('../models/auth')


router.get("/usertable",async(req,res)=>{
    const userdata=await usertable.find()
     const loginname=req.session.email
    res.render("usertable.ejs",{userdata,loginname})
})
router.get("/userform",(req,res)=>{
    res.render("userform.ejs")
})

router.post("/userform",async(req,res)=>{
   const {firstName,lastName,email,role,password}=req.body
   const record=new usertable({firstName,lastName,email,role,password:password})
   await record.save()
})

router.get('/userdelete/:id',async(req,res)=>{
    const id=req.params.id
    await usertable.findByIdAndDelete(id)
    res.redirect("/usertable")
})

router.get('/useredit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await usertable.findById(id)
    res.render("useredit.ejs",{Record})
})
router.post('/useredit/:id',async(req,res)=>{
    const {firstName,lastName,email,role}=req.body
    const id=req.params.id
    await usertable.findByIdAndUpdate(id,{firstName,lastName,email,role})
    res.redirect("/usertable")
})

 router.get('/userstatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await usertable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/usertable")
 })

router.post('/userrole/:id', async (req,res) => {

   const { role } = req.body
   const id = req.params.id

   await usertable.findByIdAndUpdate(id,{ role })
   res.redirect("/usertable")
})
module.exports=router

