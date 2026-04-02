const router = require('express').Router();
const nodemailer = require('nodemailer');

// Store active SMTP connections
let activeTransporters = new Map();

// Helper function to create transporter
function createTransporter(config) {
    return nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.secure === 'true' || config.port === '465',
        auth: {
            user: config.username,
            pass: config.password
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

// Helper function to parse multiple emails
function parseEmails(emailString) {
    if (!emailString) return [];
    return emailString
        .split(/[,\n;]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ======================
// SMTP SETTINGS PAGE
// ======================
router.get('/smtp', (req, res) => {
    // Get user info from session or request
    const loginname = req.session.user ? req.session.user.name : (req.user ? req.user.name : 'Admin');
    
    res.render("EmailNotifications/SmtpSettings", { 
        message: null, 
        error: null,
        config: req.session.smtpConfig || {},
        showEmailForm: false,
        loginname: loginname,  // Add this line
        user: req.session.user || req.user || null  // Also pass full user object if needed
    });
});

// ======================
// CONFIGURE SMTP (API)
// ======================
router.post('/configure-smtp', async (req, res) => {
    try {
        // Check if req.body exists and has data
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('Request body is empty. Headers:', req.headers);
            return res.json({ 
                success: false, 
                message: "No data received. Please check your form submission." 
            });
        }

        const { host, port, username, password, secure } = req.body;

        console.log('Received SMTP config:', { host, port, username, secure });

        if (!host || !port || !username || !password) {
            return res.json({ 
                success: false, 
                message: "All SMTP settings are required" 
            });
        }

        const config = {
            host: host.trim(),
            port: port.toString().trim(),
            username: username.trim(),
            password: password,
            secure: secure || (port === '465' ? 'true' : 'false')
        };

        // Test the connection before saving
        const testTransporter = createTransporter(config);
        await testTransporter.verify();

        // Save to session
        req.session.smtpConfig = config;
        const sessionId = req.sessionID;
        activeTransporters.set(sessionId, testTransporter);

        console.log(`SMTP configured successfully for session: ${sessionId}`);

        res.json({ 
            success: true, 
            message: "SMTP settings saved successfully!",
            showEmailForm: true
        });

    } catch (error) {
        console.error('SMTP Configuration Error:', error);
        res.json({ 
            success: false, 
            message: "Failed to connect: " + error.message 
        });
    }
});

// ======================
// SEND EMAIL FORM PAGE
// ======================
router.get('/send-email', (req, res) => {
    if (!req.session.smtpConfig) {
        return res.redirect('/smtp');
    }

    // Get user info from session or request
    const loginname = req.session.user ? req.session.user.name : (req.user ? req.user.name : 'Admin');

    res.render("EmailNotifications/SendEmail", { 
        message: null, 
        error: null,
        oldInput: {},
        config: req.session.smtpConfig,
        loginname: loginname,  // Add this line
        user: req.session.user || req.user || null  // Also pass full user object if needed
    });
});

// ======================
// SEND EMAIL (API)
// ======================
router.post('/send-email', async (req, res) => {
    try {
        if (!req.session.smtpConfig) {
            return res.json({ 
                success: false, 
                message: "SMTP not configured" 
            });
        }

        const { to, subject, message } = req.body;
        const sessionId = req.sessionID;
        let transporter = activeTransporters.get(sessionId);

        if (!transporter) {
            transporter = createTransporter(req.session.smtpConfig);
            activeTransporters.set(sessionId, transporter);
        }

        if (!to || !subject || !message) {
            return res.json({ 
                success: false, 
                message: "All fields are required" 
            });
        }

        const emailList = parseEmails(to);
        
        if (emailList.length === 0) {
            return res.json({ 
                success: false, 
                message: "Please enter at least one valid email address" 
            });
        }

        const mailOptions = {
            from: `"${req.session.smtpConfig.username.split('@')[0]}" <${req.session.smtpConfig.username}>`,
            to: emailList.join(', '),
            subject: subject,
            text: message,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                      <h2 style="color: #667eea;">${escapeHtml(subject)}</h2>
                      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
                      <hr>
                      <p style="color: #666;">Sent via ${req.session.smtpConfig.host}</p>
                   </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Recipients:', emailList);
        console.log('Subject:', subject);
        
        res.json({ 
            success: true, 
            message: `✅ Email sent successfully to ${emailList.length} recipient(s)!`,
            messageId: info.messageId,
            recipients: emailList.length
        });

    } catch (error) {
        console.error('❌ Error sending email:', error);
        
        if (error.message.includes('Invalid login') || error.message.includes('connect')) {
            activeTransporters.delete(req.sessionID);
        }

        res.json({ 
            success: false, 
            message: "Failed to send email: " + error.message 
        });
    }
});

// ======================
// TEST CONNECTION
// ======================
router.post('/test-connection', async (req, res) => {
    try {
        // Check if req.body exists
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.json({ 
                success: false, 
                message: "No data received for testing" 
            });
        }

        const { host, port, username, password, secure } = req.body;

        console.log('Testing connection with:', { host, port, username });

        if (!host || !port || !username || !password) {
            return res.json({ 
                success: false, 
                message: "All fields are required for testing" 
            });
        }

        const testConfig = {
            host: host.trim(),
            port: port.toString().trim(),
            username: username.trim(),
            password: password,
            secure: secure || (port === '465' ? 'true' : 'false')
        };

        const testTransporter = createTransporter(testConfig);
        await testTransporter.verify();

        res.json({ 
            success: true, 
            message: '✅ Connection successful!' 
        });

    } catch (error) {
        console.error('Test connection error:', error);
        res.json({ 
            success: false, 
            message: '❌ Connection failed: ' + error.message 
        });
    }
});

// ======================
// CHECK SMTP STATUS
// ======================
router.get('/status', (req, res) => {
    const sessionId = req.sessionID;
    const transporter = activeTransporters.get(sessionId);
    
    if (transporter && req.session.smtpConfig) {
        res.json({ 
            status: 'connected',
            host: req.session.smtpConfig.host,
            username: req.session.smtpConfig.username
        });
    } else {
        res.json({ 
            status: 'disconnected'
        });
    }
});

// ======================
// CLEAR SETTINGS
// ======================
router.get('/clear-settings', (req, res) => {
    activeTransporters.delete(req.sessionID);
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/smtp');
    });
});

module.exports = router;