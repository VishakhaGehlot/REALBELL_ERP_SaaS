const router=require('express').Router()
const financetable=require('../models/finance')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/financetable',
    '/financeform',
    '/financedelete',
    '/financeedit',
    '/financestatus'
]))

function buildFinanceScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        idFields: ['createdByUserId'],
        emailFields: ['createdByEmail']
    }, baseFilter)
}

router.get('/financetable',async(req,res)=>{
    const financedata=await financetable.find(buildFinanceScopeFilter(req))
     const loginname=req.session.email
    res.render("Frontend/Finance/financetable.ejs",{financedata, loginname})
})


router.get('/financeform',(req,res)=>{
    const loginname=req.session.email
    res.render("Frontend/Finance/financeform.ejs",{loginname})
})

router.post('/financeform',async(req,res)=>{
    const {title,desc1,desc2,desc3,desc4}=req.body
  const Record= await  new financetable({
    title,
    desc1,
    desc2,
    desc3,
    desc4,
    createdByUserId: req.session?.userId || null,
    createdByEmail: String(req.session?.email || '').toLowerCase()
  })
  Record.save()
  console.log(Record)
})
router.get('/financedelete/:id',async(req,res)=>{
    const id=req.params.id
    await financetable.findOneAndDelete(buildFinanceScopeFilter(req,{ _id:id }))
    res.redirect("/financetable")
})

router.get('/financeedit/:id',async(req,res)=>{
    const id=req.params.id
    const Record=await financetable.findOne(buildFinanceScopeFilter(req,{ _id:id }))
         const loginname=req.session.email

    res.render("Frontend/Finance/financeedit.ejs",{Record,loginname})
})
router.post('/financeedit/:id',async(req,res)=>{
    const {title,desc1,desc2,desc3,desc4}=req.body
    const id=req.params.id
    await financetable.findOneAndUpdate(buildFinanceScopeFilter(req,{ _id:id }),{title,desc1,desc2,desc3,desc4})
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
    await financetable.findOneAndUpdate(buildFinanceScopeFilter(req,{ _id:id }),{status:newStatus})
    res.redirect('/financetable')

})
module.exports=router
