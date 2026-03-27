const router = require('express').Router();
const addcontactTable = require('../models/addcontact');
const nodemailer = require('nodemailer');

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
router.get('/addcontacttable', async (req, res) => {
    try {
        const data = await addcontactTable.find().sort({ createdAt: -1 });
        const loginname = req.session.user ? req.session.user.name : 'Admin';
        res.render("addcontacttable.ejs", { data, loginname });
    } catch (error) {
        console.error(error);
        res.redirect('/dashboard');
    }
});

// 📌 Show Add Form - NO SESSION CHECK
router.get('/addcontactform', (req, res) => {
    // No session check - direct access
    const loginname = req.session.user ? req.session.user.name : 'Admin';
    res.render("addcontactform.ejs", { error: null, success: null, loginname });
});

// 📌 Add New Record
router.post('/addcontactform', async (req, res) => {
    try {
        const { name, phoneno, whatsappno, email, note } = req.body;
        const loginname = req.session.user ? req.session.user.name : 'Admin';
        
        if (!name || !phoneno || !email) {
            return res.render("addcontactform.ejs", { 
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
            note: note || ''
        });
        
        await newRecord.save();
        
        // After successful add, redirect to table
        res.redirect('/addcontacttable');
        
    } catch (error) {
        console.error(error);
        const loginname = req.session.user ? req.session.user.name : 'Admin';
        res.render("addcontactform.ejs", { 
            error: "Failed to add record", 
            success: null,
            loginname
        });
    }
});

// 📌 Show Edit Form
router.get('/addcontactedit/:id', async (req, res) => {
    try {
        const record = await addcontactTable.findById(req.params.id);
        if (!record) return res.redirect('/addcontacttable');
        const loginname = req.session.user ? req.session.user.name : 'Admin';
        res.render("addcontactedit.ejs", { Record: record, error: null, success: null, loginname });
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

// 📌 Update Record
router.post('/addcontactedit/:id', async (req, res) => {
    try {
        const { name, phoneno, whatsappno, email, note } = req.body;
        
        await addcontactTable.findByIdAndUpdate(req.params.id, {
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
router.post('/addcontactsend/:id', async (req, res) => {
    try {
        const record = await addcontactTable.findById(req.params.id);
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
router.get('/addcontactstatus/:id/:status', async (req, res) => {
    try {
        const currentStatus = req.params.status;
        let newStatus = "";
        if (currentStatus == "Pending") {
            newStatus = "Active";
        } else {
            newStatus = "Pending";
        }
        
        await addcontactTable.findByIdAndUpdate(req.params.id, { status: newStatus });
        res.redirect('/addcontacttable');
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

// 📌 Delete Record
router.get('/addcontactdelete/:id', async (req, res) => {
    try {
        await addcontactTable.findByIdAndDelete(req.params.id);
        res.redirect('/addcontacttable');
    } catch (error) {
        console.error(error);
        res.redirect('/addcontacttable');
    }
});

module.exports = router;