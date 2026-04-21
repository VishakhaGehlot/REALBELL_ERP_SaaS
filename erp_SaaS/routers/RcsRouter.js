const router = require('express').Router();
const axios = require('axios');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/roleAuth');
const { requireModuleAccess } = require('../middleware/permissionAuth');

// Configure multer for CSV upload
const upload = multer({ dest: 'uploads/' });

// Store campaign settings (use DB in production)
let campaignSettings = {
    apiUrl: '',
    apiKey: '',
    senderId: '',
    templateId: '',
    routeId: '1'  // Default promotional
};

// ─── HELPER: Build SMS API URL with DLT Template ID ─────────────────────────
function buildSmsUrl(numbers, message, senderId, messageType, templateId = null) {
    const apiKey = campaignSettings.apiKey || '';
    // Use passed templateId or default from settings
    const finalTemplateId = templateId || campaignSettings.templateId || '';
    const smsType = messageType === 'unicode' ? 'Unicode' : 'English';
    const encodedMsg = encodeURIComponent(message.trim());
    const numberStr = Array.isArray(numbers) ? numbers.join(',') : numbers;

    // Get the clean base URL
    let baseUrl = campaignSettings.apiUrl.trim();

    // Strip accidental double-URL
    const httpIdx = baseUrl.indexOf('http', 5);
    if (httpIdx > 0) {
        baseUrl = baseUrl.substring(0, httpIdx);
    }

    let apiUrl;

    // Check if URL uses placeholder style
    if (baseUrl.includes('[app_number]') || baseUrl.includes('[app_message]')) {
        apiUrl = baseUrl
            .replace('[app_number]', encodeURIComponent(numberStr))
            .replace('[app_message]', encodedMsg)
            .replace('[dlt_template_id]', encodeURIComponent(finalTemplateId));
    } else {
        // Standard iCloudSMS / GET-param style
        const cleanBase = baseUrl.split('?')[0];
        const params = new URLSearchParams();

        params.set('AUTH_KEY', apiKey);
        params.set('message', message.trim());
        params.set('senderId', senderId);
        params.set('routeId', campaignSettings.routeId || '1');
        params.set('mobileNos', numberStr);
        params.set('smsContentType', smsType);

        // ✅ CRITICAL: DLT Template ID must be sent properly
        if (finalTemplateId) {
            // Try different parameter names that providers use
            params.set('DLTTemplateId', finalTemplateId);
            params.set('template_id', finalTemplateId);
            params.set('dltTemplateId', finalTemplateId);
            params.set('templateId', finalTemplateId);
        }

        apiUrl = `${cleanBase}?${params.toString()}`;
    }

    return apiUrl;
}

// ─── PAGES ────────────────────────────────────────────────────────────────────
router.get("/rcscampaign", (req, res) => {
    res.render("Rcs/RcsTemplate");
});

router.get("/rcs/setting", (req, res) => {
    res.render("Rcs/RcsSetting");
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
router.post("/api/save-settings", (req, res) => {
    const { apiUrl, apiKey, senderId, templateId, routeId } = req.body;

    if (!apiUrl) {
        return res.status(400).json({ success: false, message: "API URL is required" });
    }

    // Clean the URL
    let cleanUrl = apiUrl.trim();
    const httpIdx = cleanUrl.indexOf('http', 5);
    if (httpIdx > 0) cleanUrl = cleanUrl.substring(0, httpIdx);

    campaignSettings = {
        apiUrl: cleanUrl,
        apiKey: (apiKey || '').trim(),
        senderId: (senderId || '').trim(),
        templateId: (templateId || '').trim(),
        routeId: (routeId || '1').trim()
    };

    console.log('[RCS] Settings saved:', {
        apiUrl: campaignSettings.apiUrl,
        senderId: campaignSettings.senderId,
        templateId: campaignSettings.templateId,
        routeId: campaignSettings.routeId
    });

    res.json({ success: true, message: "Settings saved successfully!" });
});

router.get("/api/get-settings", (req, res) => {
    res.json(campaignSettings);
});

// ─── TEST CONNECTION ─────────────────────────────────────────────────────────
router.post("/api/test-connection", async (req, res) => {
    const { apiUrl, apiKey, templateId } = req.body;

    let testUrl = (apiUrl || '').trim();
    const testKey = (apiKey || campaignSettings.apiKey || '').trim();
    const testTemplateId = (templateId || campaignSettings.templateId || '').trim();

    if (!testUrl) {
        return res.status(400).json({ success: false, message: "API URL is required" });
    }

    // Remove accidental URL duplication
    const httpIdx = testUrl.indexOf('http', 5);
    if (httpIdx > 0) testUrl = testUrl.substring(0, httpIdx);

    try {
        const cleanBase = testUrl.split('?')[0];
        const params = new URLSearchParams();
        params.set('AUTH_KEY', testKey);
        params.set('message', 'Test connection with DLT Template ID');
        params.set('mobileNos', '9999999999');
        params.set('senderId', campaignSettings.senderId || 'TEST');
        params.set('routeId', campaignSettings.routeId || '1');
        params.set('smsContentType', 'English');
        
        // ✅ Include template ID in test
        if (testTemplateId) {
            params.set('DLTTemplateId', testTemplateId);
            params.set('template_id', testTemplateId);
        }

        const pingUrl = `${cleanBase}?${params.toString()}`;

        console.log('[RCS] Testing connection:', pingUrl);

        const response = await axios.get(pingUrl, { timeout: 10000 });

        console.log('[RCS] Test response:', response.status, JSON.stringify(response.data).substring(0, 200));

        res.json({
            success: true,
            message: `✅ API reachable! Status: ${response.status}`,
            responsePreview: JSON.stringify(response.data).substring(0, 300)
        });

    } catch (error) {
        const status = error.response?.status;
        const errData = error.response?.data;

        console.error('[RCS] Test error:', error.message);

        if (status && status >= 400 && status < 500) {
            return res.json({
                success: true,
                message: `✅ API reachable (HTTP ${status}). Verify your AUTH_KEY & DLT Template ID.`,
                responsePreview: JSON.stringify(errData || '').substring(0, 300)
            });
        }

        res.status(500).json({
            success: false,
            message: `❌ Connection failed: ${error.message}`
        });
    }
});

// ─── SEND SMS ─────────────────────────────────────────────────────────────────
router.post("/api/send-sms", async (req, res) => {
    try {
        const { senderId, mobileNumbers, message, messageType, templateId } = req.body;

        if (!mobileNumbers || !mobileNumbers.trim()) {
            return res.status(400).json({ success: false, message: 'Mobile numbers are required' });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        if (!campaignSettings.apiUrl) {
            return res.status(400).json({
                success: false,
                message: '⚠️ API URL not configured. Please save Gateway Settings first.'
            });
        }

        // Parse + validate mobile numbers
        let numbers = mobileNumbers.includes('\n')
            ? mobileNumbers.split('\n').map(n => n.trim()).filter(Boolean)
            : mobileNumbers.split(',').map(n => n.trim()).filter(Boolean);

        numbers = numbers.filter(n => /^[6-9]\d{9}$/.test(n));

        if (numbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid 10-digit Indian mobile numbers found'
            });
        }

        const finalSenderId = (senderId || campaignSettings.senderId || '').trim();
        const finalTemplateId = (templateId || campaignSettings.templateId || '').trim();

        if (!campaignSettings.apiKey) {
            return res.status(400).json({
                success: false,
                message: '⚠️ AUTH_KEY (API Key) not configured in Gateway Settings!'
            });
        }

        // ✅ Check if DLT Template ID is required but missing
        const isTransactional = campaignSettings.routeId === '2' || campaignSettings.routeId === '4';
        if (isTransactional && !finalTemplateId) {
            return res.status(400).json({
                success: false,
                message: '⚠️ DLT Template ID is required for Transactional/OTP messages! Please add it in Gateway Settings.'
            });
        }

        const apiUrl = buildSmsUrl(numbers, message, finalSenderId, messageType, finalTemplateId);

        console.log('[RCS] Sending SMS with DLT Template ID:', finalTemplateId);
        console.log('[RCS] SMS URL:', apiUrl);

        const response = await axios.get(apiUrl, { timeout: 30000 });

        console.log('[RCS] API Response:', JSON.stringify(response.data).substring(0, 500));

        const resStr = JSON.stringify(response.data).toLowerCase();

        // Check for DLT template errors
        if (resStr.includes('template') && (resStr.includes('invalid') || resStr.includes('not found') || resStr.includes('mismatch'))) {
            return res.json({
                success: false,
                message: `❌ DLT Template ID Error: Your Template ID may be invalid or not approved. Please verify with your provider.`,
                apiResponse: JSON.stringify(response.data)
            });
        }

        // iCloudSMS: responseCode 3009 = Unauthorized
        if (resStr.includes('"responseCode":"3009"') || resStr.includes('"response":"unauthorized"')) {
            return res.json({
                success: false,
                message: `❌ Unauthorized (3009): Your AUTH_KEY is invalid or inactive. Check Gateway Settings.`,
                apiResponse: JSON.stringify(response.data)
            });
        }

        if (resStr.includes('invalid') || resStr.includes('"error"') || resStr.includes('fail')) {
            return res.json({
                success: false,
                message: `⚠️ API error: ${JSON.stringify(response.data).substring(0, 200)}`,
                apiResponse: JSON.stringify(response.data)
            });
        }

        res.json({
            success: true,
            message: `✅ SMS sent successfully to ${numbers.length} number(s)!`,
            count: numbers.length,
            apiResponse: JSON.stringify(response.data).substring(0, 300)
        });

    } catch (error) {
        console.error('[RCS] SMS error:', error.message);
        res.status(500).json({
            success: false,
            message: '❌ Failed: ' + (error.response?.data
                ? JSON.stringify(error.response.data).substring(0, 200)
                : error.message)
        });
    }
});

// ─── SCHEDULE SMS ─────────────────────────────────────────────────────────────
router.post("/api/schedule-sms", async (req, res) => {
    try {
        const { senderId, mobileNumbers, message, messageType, scheduleTime, templateId } = req.body;

        if (!mobileNumbers || !message) {
            return res.status(400).json({ success: false, message: 'Numbers and message are required' });
        }
        if (!campaignSettings.apiUrl) {
            return res.status(400).json({
                success: false,
                message: '⚠️ API URL not configured. Please save Gateway Settings first.'
            });
        }

        let numbers = mobileNumbers.includes('\n')
            ? mobileNumbers.split('\n').map(n => n.trim()).filter(Boolean)
            : mobileNumbers.split(',').map(n => n.trim()).filter(Boolean);

        numbers = numbers.filter(n => /^[6-9]\d{9}$/.test(n));

        if (numbers.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid mobile numbers found' });
        }

        const scheduledDate = new Date(scheduleTime);
        const now = new Date();

        if (scheduledDate <= now) {
            return res.status(400).json({
                success: false,
                message: 'Schedule time must be in the future'
            });
        }

        const delay = scheduledDate.getTime() - now.getTime();
        const finalSenderId = (senderId || campaignSettings.senderId || '').trim();
        const finalTemplateId = (templateId || campaignSettings.templateId || '').trim();

        console.log(`[RCS] Scheduled for ${scheduledDate.toLocaleString()} (${Math.round(delay / 1000)}s)`);

        setTimeout(async () => {
            try {
                const apiUrl = buildSmsUrl(numbers, message, finalSenderId, messageType, finalTemplateId);
                console.log('[RCS] Executing scheduled SMS with Template ID:', finalTemplateId);
                const response = await axios.get(apiUrl, { timeout: 30000 });
                console.log('[RCS] Scheduled SMS response:', JSON.stringify(response.data).substring(0, 200));
            } catch (err) {
                console.error('[RCS] Scheduled SMS failed:', err.message);
            }
        }, delay);

        res.json({
            success: true,
            message: `📅 SMS scheduled for ${scheduledDate.toLocaleString()} to ${numbers.length} number(s)!`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to schedule SMS: ' + error.message
        });
    }
});

// ─── IMPORT CSV ───────────────────────────────────────────────────────────────
router.post("/api/import-csv", upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const results = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            const mobileNumbers = results
                .map(row => (
                    row.mobile || row.phone || row.number ||
                    row.Mobile || row.Phone || row.Number ||
                    Object.values(row)[0]
                ))
                .map(n => String(n || '').trim())
                .filter(n => /^[6-9]\d{9}$/.test(n));

            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            if (mobileNumbers.length === 0) {
                return res.json({ success: false, message: 'No valid mobile numbers found in CSV' });
            }

            res.json({
                success: true,
                numbers: mobileNumbers.join(','),
                count: mobileNumbers.length,
                message: `${mobileNumbers.length} numbers imported`
            });
        })
        .on('error', (error) => {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ success: false, message: 'Error reading CSV: ' + error.message });
        });
});

module.exports = router;