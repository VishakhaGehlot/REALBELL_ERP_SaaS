const router=require('express').Router()
const financetable=require('../models/finance')

router.get('/financetable',async(req,res)=>{
    const financedata=await financetable.find()
     const loginname=req.session.email
    res.render("financetable.ejs",{financedata, loginname})
})


router.get('/financeform',(req,res)=>{
    res.render("financeform.ejs")
})

router.post('/financeform',async(req,res)=>{
    const {title,desc1,desc2,desc3,desc4}=req.body
  const Record= await  new financetable({title,desc1,desc2,desc3,desc4})
  Record.save()
  console.log(Record)
})
router.get('/financedelete/:id',async(req,res)=>{
    const id=req.params.id
    await financetable.findByIdAndDelete(id)
    res.redirect("/financetable")
})

router.get('/financeedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await financetable.findById(id)
    res.render("financeedit.ejs",{Record})
})
router.post('/financeedit/:id',async(req,res)=>{
    const {title,desc1,desc2,desc3,desc4}=req.body
    const id=req.params.id
    await financetable.findByIdAndUpdate(id,{title,desc1,desc2,desc3,desc4})
})

router.get('/financestatus/:id/:status',async(req,res)=>{
    const id=req.params.id
    const currentStatus=req.params.status
    let newStatus=""
    if(currentStatus=="Pending"){
        newStatus="Active"
    }else{
        newStatus="Pending"
    }
    await financetable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect('/financetable')

})
module.exports=router