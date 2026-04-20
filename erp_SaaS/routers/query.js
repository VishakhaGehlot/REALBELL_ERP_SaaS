const router=require('express').Router()
const querytable=require('../models/query')
const nodemailer=require('nodemailer')
const { requireAuth } = require('../middleware/roleAuth')
const { requireModuleAccess } = require('../middleware/permissionAuth')

router.get('/contact',(req,res)=>{
    res.render("Home/contact.ejs")
})
router.post('/contact',async(req,res)=>{
    const {fname,lname,email,phone,moreDesc}=req.body
    
    // Save to query table as originally planned
    const Record=await querytable({firstName:fname,lastName:lname,email,phone,message:moreDesc})
    await Record.save()
    
    // Also add to CRM Leads as requested
    try {
        const CrmLead = require('../models/CrmLead');
        const CrmActivity = require('../models/CrmActivity');
        
        const lead = new CrmLead({
            name: fname + (lname ? ' ' + lname : ''),
            email: email,
            phone: phone || '',
            source: 'Website',
            status: 'New',
            score: 50,
            assignedTo: 'Unassigned'
        });
        await lead.save();
        
        await new CrmActivity({
            type: "Note",
            description: "Lead generated from Contact Us Form. Message: " + moreDesc,
            referenceModel: "CrmLead",
            referenceId: lead._id
        }).save();
    } catch(err) {
        console.error("Error saving lead from contact form:", err);
    }
    
    res.render("Home/contact", { success: "Thank you for contacting us. We will get back to you shortly!" });
})

router.use(requireAuth)
router.use(requireModuleAccess('queryManagement'))

router.get('/querytable',async(req,res)=>{
    const querydata = await querytable.find()
     const loginname=req.session.email
    res.render("Query/querytable.ejs",{querydata, loginname})
})

router.get('/queryreplyform/:id', async (req, res) => {
    const data = await querytable.findById(req.params.id)
    const loginname = req.session.email

    res.render("Query/queryform.ejs", { data, loginname })
})

router.post('/queryreplyform/:id', async (req, res) => {
    const { from, to, subject, message } = req.body

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: "swatis8102@gmail.com",
            pass: "bljvqtvbllernhdy",
        },
    });

    await transporter.sendMail({
        from,
        to,
        subject,
        text: message
    });

    const data = await querytable.findById(req.params.id)
    data.replied = true
    await data.save()

    res.redirect('/querytable')
})
module.exports=router
