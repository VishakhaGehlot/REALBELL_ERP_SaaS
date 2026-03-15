const router=require('express').Router()
const bannerTable=require('../models/Banner')
const accountTable=require('../models/Accounting')
const faqtable=require('../models/faq')
const managetable=require('../models/manage')
const leadstable=require('../models/leads')
const solutiontable=require('../models/solution')
const financetable=require('../models/finance')
const premiumstable=require('../models/premiums')
const swipertable=require('../models/swiper')
const footertable=require('../models/footer')


router.get('/',async(req,res)=>{
    const Record=await bannerTable.find({status:"Active"})
    const data=await accountTable.find({status:"Active"})
    const faqdata=await faqtable.find({status:"Active"})
    const managedata=await managetable.find({status:"Active"})
    const leadsdata=await leadstable.find({status:"Active"})
    const solutiondata=await solutiontable.find({status:"Active"})
    const financedata=await financetable.find({status:"Active"})
    const premiumsdata=await premiumstable.find({status:"Active"})
    const  swiperdata=await swipertable.find({status:"Active"})
    const  footerdata=await footertable.find({status:"Active"})


    res.render("Home.ejs",{Record,data,faqdata,managedata,leadsdata,solutiondata,financedata,premiumsdata,swiperdata,footerdata})
})

module.exports=router