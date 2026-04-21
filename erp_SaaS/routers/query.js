const router=require('express').Router()
const querytable=require('../models/query')
const nodemailer=require('nodemailer')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')

function buildQueryScopeFilter(req, baseFilter = {}, { includeUnassigned = false } = {}) {
    const clauses = []
    const userId = req.session?.userId || null
    const exactEmail = String(req.session?.email || '').trim()
    const normalizedEmail = exactEmail.toLowerCase()

    if (userId) {
        clauses.push({ handledByUserId: userId })
    }

    if (exactEmail) {
        clauses.push({ handledByEmail: exactEmail })
    }

    if (normalizedEmail && normalizedEmail !== exactEmail) {
        clauses.push({ handledByEmail: normalizedEmail })
    }

    if (includeUnassigned) {
        clauses.push({
            $or: [
                { handledByUserId: null },
                { handledByEmail: "" }
            ]
        })
    }

    if (!clauses.length) {
        return { ...baseFilter, _id: null }
    }

    return {
        $and: [
            baseFilter,
            { $or: clauses }
        ]
    }
}

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
router.use(requireScopedModuleAccess('queryManagement', [
    '/querytable',
    '/queryreplyform',
    '/querydelete'
]))

router.get('/querytable',async(req,res)=>{
    const querydata = await querytable
        .find(buildQueryScopeFilter(req, {}, { includeUnassigned: true }))
        .sort({ handledAt: -1, createdDate: -1 })
     const loginname=req.session.email
    res.render("Query/querytable.ejs",{querydata, loginname})
})

router.get('/queryreplyform/:id', async (req, res) => {
    const data = await querytable.findOne(buildQueryScopeFilter(req, { _id: req.params.id }, { includeUnassigned: true }))
    if (!data) {
        return res.redirect('/querytable')
    }

    if (!data.handledByUserId && !data.handledByEmail) {
        data.handledByUserId = req.session?.userId || null
        data.handledByEmail = String(req.session?.email || '').toLowerCase()
        data.handledAt = new Date()
        await data.save()
    }

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

    const data = await querytable.findOne(buildQueryScopeFilter(req, { _id: req.params.id }, { includeUnassigned: true }))
    if (!data) {
        return res.redirect('/querytable')
    }
    data.replied = true
    data.handledByUserId = req.session?.userId || null
    data.handledByEmail = String(req.session?.email || '').toLowerCase()
    data.handledAt = new Date()
    await data.save()

    res.redirect('/querytable')
})

router.get('/querydelete/:id', async (req, res) => {
    await querytable.findOneAndDelete(buildQueryScopeFilter(req, { _id: req.params.id }, { includeUnassigned: true }))
    res.redirect('/querytable')
})
module.exports=router
