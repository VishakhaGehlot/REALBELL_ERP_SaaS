const router = require('express').Router();
const addcontactTable = require('../models/CRM');
const nodemailer = require('nodemailer');
const { requireAuth } = require('../middleware/roleAuth');
const { requireModuleAccess } = require('../middleware/permissionAuth');
const { getUserScope } = require('../middleware/dataScope');

router.use(requireAuth);

function buildScopedCRMFilter(scope) {
    if (scope.fullAccess) return {}
    return {
        $or: [
            { ownerUserId: { $in: scope.userIds } },
            { ownerEmail: { $in: scope.emails } }
        ]
    }
}

// ========== EMAIL CONFIGURATION ==========
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "swatis8102@gmail.com",
        pass: "bljvqtvbllernhdy",
    },
});

// ========== MIDDLEWARE - Check if logged in (optional) ==========
// Uncomment if you want to protect routes
// const requireLogin = (req, res, next) => {
//     if (!req.session.user) {
//         return res.redirect('/login');
//     }
//     next();
// };

// ========== CRM ROUTES ==========

// 📌 Show All CRM Records
router.get('/addcontacttable', requireModuleAccess('crm'), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const data = await addcontactTable.find(buildScopedCRMFilter(scope)).sort({ createdAt: -1 });
        const loginname = req.session.email || 'Admin';
        res.render("CRM/addcontacttable.ejs", { data, loginname });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load CRM contacts.");
    }
});

// 📌 Show Add Form - NO SESSION CHECK
router.get('/addcontactform', requireModuleAccess('crm', 'add'), (req, res) => {
    const loginname = req.session.email || 'Admin';
    res.render("CRM/addcontactform.ejs", { error: null, success: null, loginname });
});

// 📌 Add New Record
router.post('/addcontactform', requireModuleAccess('crm', 'add'), async (req, res) => {
    try {
        const { name, phoneno, whatsappno, email, note } = req.body;
        const loginname = req.session.email || 'Admin';
        const scope = await getUserScope(req)
        
        if (!name || !phoneno || !email) {
            return res.render("CRM/addcontactform.ejs", { 
                error: "Name, Phone and Email are required!", 
                success: null,
                loginname
            });
        }
        
        const newRecord = new addcontactTable({
            name,
            phoneno,
            whatsappno: whatsappno || '',
            email,
            note: note || '',
            ownerUserId: scope.userIds[0] || null,
            ownerEmail: loginname.toLowerCase()
        });
        
        await newRecord.save();
        
        // After successful add, redirect to table
        res.redirect('/addcontacttable');
        
    } catch (error) {
        console.error(error);
        const loginname = req.session.email || 'Admin';
        res.render("CRM/addcontactform.ejs", { 
            error: "Failed to add record", 
            success: null,
            loginname
        });
    }
});

// 📌 Show Edit Form
router.get('/addcontactedit/:id', requireModuleAccess('crm', 'edit'), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const record = await addcontactTable.findOne({
            _id: req.params.id,
            ...buildScopedCRMFilter(scope)
        });
        if (!record) return res.redirect('/addcontacttable');
        const loginname = req.session.email || 'Admin';
        res.render("CRM/addcontactedit.ejs", { Record: record, error: null, success: null, loginname });
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

// 📌 Update Record
router.post('/addcontactedit/:id', requireModuleAccess('crm', 'edit'), async (req, res) => {
    try {
        const { name, phoneno, whatsappno, email, note } = req.body;
        const scope = await getUserScope(req)
        
        await addcontactTable.findOneAndUpdate({
            _id: req.params.id,
            ...buildScopedCRMFilter(scope)
        }, {
            name,
            phoneno,
            whatsappno: whatsappno || '',
            email,
            note: note || ''
        });
        
        res.redirect('/addcontacttable');
    } catch (error) {
        console.error(error);
        res.redirect(`/addcontactedit/${req.params.id}`);
    }
});

// 📌 Send Email
router.post('/addcontactsend/:id', requireModuleAccess('crm', 'edit'), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const record = await addcontactTable.findOne({
            _id: req.params.id,
            ...buildScopedCRMFilter(scope)
        });
        if (!record) return res.redirect('/addcontacttable');
        
        const { subject, message } = req.body;
        
        await transporter.sendMail({
            from: 'swatis8102@gmail.com',
            to: record.email,
            subject: subject || "Message from REAL ERP",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eef2f6; border-radius: 10px;">
                    <div style="background: linear-gradient(135deg, #0f1c33, #1a2b4a); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h2 style="color: #d4a017; margin: 0;">REAL ERP</h2>
                        <p style="color: white; margin: 5px 0 0;">Enterprise Resource Planning</p>
                    </div>
                    <div style="padding: 20px;">
                        <h3 style="color: #0f1c33;">Hello ${record.name},</h3>
                        <p style="color: #4b5563; line-height: 1.6;">${message}</p>
                        <hr style="border: none; border-top: 1px solid #eef2f6; margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 12px;">This is an automated message from REAL ERP System. Please do not reply to this email.</p>
                    </div>
                </div>
            `
        });
        
        if (message) {
            const existingNote = record.note ? record.note + '\n\n' : '';
            await addcontactTable.findByIdAndUpdate(req.params.id, {
                note: existingNote + `[${new Date().toLocaleString()}] ${message}`
            });
        }
        
        res.redirect(`/addcontactedit/${req.params.id}`);
    } catch (error) {
        console.error("Error sending email:", error);
        res.redirect(`/addcontactedit/${req.params.id}`);
    }
});

// 📌 Update Status
router.get('/addcontactstatus/:id/:status', requireModuleAccess('crm', 'edit'), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const currentStatus = req.params.status;
        let newStatus = "";
        if (currentStatus == "Pending") {
            newStatus = "Active";
        } else {
            newStatus = "Pending";
        }
        
        await addcontactTable.findOneAndUpdate({
            _id: req.params.id,
            ...buildScopedCRMFilter(scope)
        }, { status: newStatus });
        res.redirect('/addcontacttable');
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

// 📌 Delete Record
router.get('/addcontactdelete/:id', requireModuleAccess('crm', 'delete'), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        await addcontactTable.findOneAndDelete({
            _id: req.params.id,
            ...buildScopedCRMFilter(scope)
        });
        res.redirect('/addcontacttable');
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

module.exports = router;
