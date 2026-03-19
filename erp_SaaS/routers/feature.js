const router=require('express').Router()
const upload=require('../middleware/multer')
const FeatureTable=require('../models/feature')


router.get('/featuretable',async(req,res)=>{
    const featuredata=await  FeatureTable.find()
     const loginname=req.session.email
    res.render("FeatureTable.ejs",{featuredata,loginname})
})

router.get('/featureform',(req,res)=>{
         const loginname=req.session.email

    res.render("FeatureForm.ejs",{loginname})
})
router.post('/featureform',upload.single('img'),async(req,res)=>{
   const {title,desc}=req.body
   const imageFile=req.file.filename
   const Record=await FeatureTable({title:title,desc:desc,img:imageFile})
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
    await FeatureTable.findByIdAndUpdate(id,{status:newStatus})
    res.redirect("/featuretable")
     
})
 router.get('/featuredelete/:id',async(req,res)=>{
    const id=req.params.id
    await FeatureTable.findByIdAndDelete(id)
    res.redirect('/featuretable')
    
})
router.get('/featureedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await FeatureTable.findById(id)
         const loginname=req.session.email

    res.render("FeatureEdit.ejs",{Record,loginname})
})
router.post('/featureedit/:id',async(req,res)=>{
    const{title,desc}=req.body
    const id=req.params.id
    await FeatureTable.findByIdAndUpdate(id,{title:title,desc,desc})
    
})



module.exports=router