const crypto = require('crypto');
const https = require('https');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = require('express').Router();
const subTable = require('../models/subscription');
const registerTable = require('../models/userPlan');
const paymentGatewaySettingTable = require('../models/paymentGatewaySetting');
const logincheck = require('../middleware/logincheck');

const CURRENCY = 'INR';

function normalizeCredential(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return '';
    }

    let normalized = trimmed.replace(/^['"`](.*)['"`]$/, '$1').trim();

    normalized = normalized
        .replace(/^(RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|key_id|key_secret)\s*[:=]\s*/i, '')
        .replace(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*/, '')
        .trim()
        .replace(/[;,]+$/, '')
        .trim();

    normalized = normalized.replace(/^['"`](.*)['"`]$/, '$1').trim();
    return normalized.replace(/\r?\n/g, '');
}

async function getRazorpayConfig() {
    const storedConfig = await paymentGatewaySettingTable.findOne({
        provider: 'razorpay',
        isActive: true
    }).sort({ updatedAt: -1, _id: -1 });

    const dbKeyId = normalizeCredential(storedConfig?.keyId);
    const dbKeySecret = normalizeCredential(storedConfig?.keySecret);

    return {
        keyId: dbKeyId || '',
        keySecret: dbKeySecret || '',
        customUpiPayload: sanitizeText(storedConfig?.customUpiPayload),
        source: dbKeyId || dbKeySecret ? 'database' : 'missing',
        updatedAt: storedConfig?.updatedAt || null,
        updatedBy: storedConfig?.updatedBy || ''
    };
}

async function getRazorpayCredentialCandidates() {
    const storedConfig = await paymentGatewaySettingTable.findOne({
        provider: 'razorpay',
        isActive: true
    }).sort({ updatedAt: -1, _id: -1 });

    const candidates = [];
    const seen = new Set();

    const pushCandidate = (keyId, keySecret, source) => {
        const normalizedKeyId = normalizeCredential(keyId);
        const normalizedKeySecret = normalizeCredential(keySecret);

        if (!normalizedKeyId || !normalizedKeySecret) {
            return;
        }

        const key = `${normalizedKeyId}:${normalizedKeySecret}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        candidates.push({
            keyId: normalizedKeyId,
            keySecret: normalizedKeySecret,
            source
        });
    };

    pushCandidate(storedConfig?.keyId, storedConfig?.keySecret, 'database');

    return candidates;
}

function maskSecret(secret) {
    const value = String(secret || '').trim();

    if (!value) {
        return '';
    }

    if (value.length <= 8) {
        return '*'.repeat(value.length);
    }

    return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;
}

function parsePlanPrice(value) {
    const price = Number(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(price) ? price : 0;
}

function sanitizeText(value) {
    return String(value || '').trim();
}

function safeAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

function buildInvoiceNumber(record) {
    const invoiceDate = new Date(record.paidAt || record.createdAt || Date.now());
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const day = String(invoiceDate.getDate()).padStart(2, '0');
    const suffix = String(record._id || '').slice(-6).toUpperCase() || '000000';
    return `INV-${year}${month}${day}-${suffix}`;
}

function buildFallbackTransactionId(record) {
    const suffix = String(record._id || '').slice(-8).toUpperCase() || Date.now();
    return `TXN-${suffix}`;
}

function createSubscriptionIdentity(record = {}) {
    const email = sanitizeText(record.email).toLowerCase();
    const businessEmail = sanitizeText(record.businessEmail).toLowerCase();
    const phone = sanitizeText(record.phone);
    const planId = String(record.planId || '');
    return `${email}|${businessEmail}|${phone}|${planId}`;
}

async function resolvePendingDuplicatesForPaidRecord(paidRecord) {
    if (!paidRecord) {
        return;
    }

    await registerTable.updateMany(
        {
            _id: { $ne: paidRecord._id },
            paymentStatus: 'Pending',
            subscriptionStatus: 'Pending',
            email: sanitizeText(paidRecord.email).toLowerCase(),
            businessEmail: sanitizeText(paidRecord.businessEmail).toLowerCase(),
            phone: sanitizeText(paidRecord.phone),
            planId: paidRecord.planId
        },
        {
            $set: {
                paymentStatus: 'Failed',
                subscriptionStatus: 'Cancelled'
            }
        }
    );
}

function hidePendingWhenPaidExists(records = []) {
    const paidKeys = new Set(
        records
            .filter((record) => sanitizeText(record.paymentStatus).toLowerCase() === 'paid')
            .map((record) => createSubscriptionIdentity(record))
    );

    return records.filter((record) => {
        const isPending = sanitizeText(record.paymentStatus).toLowerCase() === 'pending';
        if (!isPending) {
            return true;
        }

        return !paidKeys.has(createSubscriptionIdentity(record));
    });
}

function normalizeRegistrationData(payload = {}) {
    return {
        name: sanitizeText(payload.name),
        email: sanitizeText(payload.email).toLowerCase(),
        phone: sanitizeText(payload.phone),
        businessName: sanitizeText(payload.businessName),
        address: sanitizeText(payload.address),
        businessType: sanitizeText(payload.businessType),
        businessEmail: sanitizeText(payload.businessEmail).toLowerCase(),
        businessPhone: sanitizeText(payload.businessPhone),
        password: sanitizeText(payload.password),
        confirmPassword: sanitizeText(payload.confirmPassword)
    };
}

function validateRegistrationData(data) {
    const errors = [];

    if (!data.name) errors.push('Name is required.');
    if (!data.email) errors.push('Email is required.');
    if (!data.phone) errors.push('Phone is required.');
    if (!data.businessName) errors.push('Business name is required.');
    if (!data.address) errors.push('Address is required.');
    if (!data.businessType) errors.push('Business type is required.');
    if (!data.businessEmail) errors.push('Business email is required.');
    if (!data.businessPhone) errors.push('Business phone is required.');
    if (!data.password) errors.push('Password is required.');
    if (!data.confirmPassword) errors.push('Confirm password is required.');
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
        errors.push('Password and confirm password must match.');
    }

    return errors;
}

async function findSelectedPlan({ planId, plan, price }) {
    let selectedPlan = null;

    if (planId && mongoose.isValidObjectId(planId)) {
        selectedPlan = await subTable.findById(planId);
    }

    if (!selectedPlan && plan) {
        selectedPlan = await subTable.findOne({ title: plan });
    }

    if (!selectedPlan) {
        const activePlans = await subTable.find({ Status: 'Active' }).sort({ createdAt: 1, _id: 1 });
        selectedPlan = activePlans[0] || null;
    }

    if (!selectedPlan) {
        return null;
    }

    const normalizedPrice = parsePlanPrice(selectedPlan.price || price);

    return {
        _id: selectedPlan._id,
        title: selectedPlan.title,
        price: normalizedPrice,
        features: Array.isArray(selectedPlan.features) ? selectedPlan.features : [],
        Status: selectedPlan.Status
    };
}

function executeRazorpayApiRequest({ keyId, keySecret, path, method = 'POST', payload }) {
    return new Promise((resolve, reject) => {
        const body = payload ? JSON.stringify(payload) : '';
        const headers = {
            'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
        };

        if (payload) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const request = https.request({
            hostname: 'api.razorpay.com',
            path,
            method,
            headers
        }, (response) => {
            let rawData = '';

            response.on('data', (chunk) => {
                rawData += chunk;
            });

            response.on('end', () => {
                let parsed = {};

                try {
                    parsed = rawData ? JSON.parse(rawData) : {};
                } catch (error) {
                    reject(new Error('Unexpected response received from Razorpay.'));
                    return;
                }

                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(parsed);
                    return;
                }

                const apiError = new Error(parsed.error?.description || 'Unable to process Razorpay request.');
                apiError.statusCode = response.statusCode;
                apiError.razorpayCode = parsed.error?.code || '';
                reject(apiError);
            });
        });

        request.on('error', reject);
        if (body) {
            request.write(body);
        }
        request.end();
    });
}

function toRazorpayFriendlyError(error) {
    const statusCode = Number(error?.statusCode || 0);
    const rawMessage = String(error?.message || '').toLowerCase();
    const isAuthMessage = rawMessage.includes('authentication failed') || rawMessage.includes('invalid api key');
    if (statusCode === 401 || statusCode === 403 || isAuthMessage) {
        return new Error('Razorpay authentication failed. Use API Keys from Razorpay Dashboard (not webhook secret), keep Key ID and Secret from same mode (both test or both live), and avoid pasting full env variable names.');
    }
    return error;
}

async function callRazorpayApiWithCredential({ path, method = 'POST', payload, preferredKeyId = '' }) {
    const candidates = await getRazorpayCredentialCandidates();

    if (!candidates.length) {
        throw new Error('Razorpay settings are missing. Please configure key ID and key secret in Subscription Payment Settings.');
    }

    const normalizedPreferredKeyId = normalizeCredential(preferredKeyId);
    const orderedCandidates = normalizedPreferredKeyId
        ? [
            ...candidates.filter((item) => item.keyId === normalizedPreferredKeyId),
            ...candidates.filter((item) => item.keyId !== normalizedPreferredKeyId)
        ]
        : candidates;

    let lastError = null;

    for (const credential of orderedCandidates) {
        try {
            const data = await executeRazorpayApiRequest({
                keyId: credential.keyId,
                keySecret: credential.keySecret,
                path,
                method,
                payload
            });

            return {
                data,
                credential
            };
        } catch (error) {
            lastError = error;
            const rawMessage = String(error?.message || '').toLowerCase();
            const isAuthenticationError = Number(error.statusCode) === 401
                || Number(error.statusCode) === 403
                || rawMessage.includes('authentication failed')
                || rawMessage.includes('invalid api key');
            if (!isAuthenticationError) {
                throw error;
            }
        }
    }

    if (lastError) {
        throw toRazorpayFriendlyError(lastError);
    }

    throw new Error('Unable to process Razorpay request.');
}

async function callRazorpayApi({ path, method = 'POST', payload, preferredKeyId = '' }) {
    const result = await callRazorpayApiWithCredential({ path, method, payload, preferredKeyId });
    return result.data;
}

async function buildPricingPageData(query = {}) {
    const plans = await subTable.find({ Status: 'Active' }).sort({ _id: 1 });
    const selectedPlan = await findSelectedPlan(query);

    return {
        plans,
        selectedPlan
    };
}

function setCheckoutDraft(req, payload) {
    req.session.subscriptionCheckoutDraft = {
        ...payload,
        createdAt: Date.now()
    };
}

function getCheckoutDraft(req) {
    return req.session.subscriptionCheckoutDraft || null;
}

function setCheckoutDraftPaymentLink(req, paymentLink) {
    if (!req.session.subscriptionCheckoutDraft) {
        return;
    }

    req.session.subscriptionCheckoutDraft.paymentLink = {
        id: paymentLink.id,
        shortUrl: paymentLink.short_url,
        keyId: normalizeCredential(paymentLink.keyId),
        status: paymentLink.status,
        createdAt: Date.now()
    };
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function createOrRefreshPendingSubscription({ registration, selectedPlan }) {
    const filters = {
        paymentStatus: 'Pending',
        subscriptionStatus: 'Pending',
        email: registration.email,
        businessEmail: registration.businessEmail,
        phone: registration.phone,
        planId: selectedPlan._id
    };

    const existingPending = await registerTable.findOne(filters).sort({ createdAt: -1, _id: -1 });
    const hashedPassword = await bcrypt.hash(registration.password, 10);
    const payload = {
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        businessName: registration.businessName,
        address: registration.address,
        businessType: registration.businessType,
        businessEmail: registration.businessEmail,
        businessPhone: registration.businessPhone,
        password: hashedPassword,
        planId: selectedPlan._id,
        planName: selectedPlan.title,
        planPrice: selectedPlan.price,
        paymentStatus: 'Pending',
        subscriptionStatus: 'Pending',
        paidAt: null
    };

    if (existingPending) {
        Object.assign(existingPending, payload);
        return existingPending.save();
    }

    return registerTable.create(payload);
}

async function finalizeSubscriptionPayment({ registration, selectedPlan, paymentMeta = {} }) {
    const razorpayOrderId = sanitizeText(paymentMeta.razorpayOrderId || paymentMeta.orderId);
    const razorpayPaymentId = sanitizeText(paymentMeta.razorpayPaymentId || paymentMeta.paymentId);
    const razorpaySignature = sanitizeText(paymentMeta.razorpaySignature || paymentMeta.signature);
    const razorpayPaymentLinkId = sanitizeText(paymentMeta.razorpayPaymentLinkId || paymentMeta.paymentLinkId || paymentMeta.id);
    const pendingRegistrationId = sanitizeText(paymentMeta.pendingRegistrationId);

    const filters = [];
    if (razorpayPaymentId) {
        filters.push({ razorpayPaymentId });
    }
    if (razorpayPaymentLinkId) {
        filters.push({ razorpayPaymentLinkId });
    }

    if (filters.length) {
        const existingRecord = await registerTable.findOne({ $or: filters });
        if (existingRecord) {
            if (existingRecord.paymentStatus !== 'Paid' || existingRecord.subscriptionStatus !== 'Pending') {
                existingRecord.paymentStatus = 'Paid';
                existingRecord.subscriptionStatus = 'Pending';
                existingRecord.paidAt = new Date();
                existingRecord.paymentMethod = sanitizeText(paymentMeta.paymentMethod || existingRecord.paymentMethod || 'Razorpay');
                if (razorpayOrderId) existingRecord.razorpayOrderId = razorpayOrderId;
                if (razorpayPaymentId) existingRecord.razorpayPaymentId = razorpayPaymentId;
                if (razorpayPaymentLinkId) existingRecord.razorpayPaymentLinkId = razorpayPaymentLinkId;
                if (razorpaySignature) existingRecord.razorpaySignature = razorpaySignature;
                await existingRecord.save();
            }
            await resolvePendingDuplicatesForPaidRecord(existingRecord);
            return existingRecord;
        }
    }

    let pendingRecord = null;
    if (pendingRegistrationId && mongoose.isValidObjectId(pendingRegistrationId)) {
        pendingRecord = await registerTable.findById(pendingRegistrationId);
    }

    if (!pendingRecord) {
        pendingRecord = await registerTable.findOne({
            paymentStatus: 'Pending',
            subscriptionStatus: 'Pending',
            email: registration.email,
            businessEmail: registration.businessEmail,
            phone: registration.phone,
            planId: selectedPlan._id
        }).sort({ createdAt: -1, _id: -1 });
    }

    if (pendingRecord) {
        pendingRecord.name = registration.name;
        pendingRecord.email = registration.email;
        pendingRecord.phone = registration.phone;
        pendingRecord.businessName = registration.businessName;
        pendingRecord.address = registration.address;
        pendingRecord.businessType = registration.businessType;
        pendingRecord.businessEmail = registration.businessEmail;
        pendingRecord.businessPhone = registration.businessPhone;
        pendingRecord.planId = selectedPlan._id;
        pendingRecord.planName = selectedPlan.title;
        pendingRecord.planPrice = selectedPlan.price;
        pendingRecord.paymentMethod = sanitizeText(paymentMeta.paymentMethod || pendingRecord.paymentMethod || 'Razorpay');
        pendingRecord.paymentStatus = 'Paid';
        pendingRecord.subscriptionStatus = 'Pending';
        pendingRecord.paidAt = new Date();
        pendingRecord.razorpayOrderId = razorpayOrderId;
        pendingRecord.razorpayPaymentId = razorpayPaymentId;
        pendingRecord.razorpayPaymentLinkId = razorpayPaymentLinkId;
        pendingRecord.razorpaySignature = razorpaySignature;
        const savedRecord = await pendingRecord.save();
        await resolvePendingDuplicatesForPaidRecord(savedRecord);
        return savedRecord;
    }

    const hashedPassword = await bcrypt.hash(registration.password, 10);

    const savedRecord = await registerTable.create({
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        businessName: registration.businessName,
        address: registration.address,
        businessType: registration.businessType,
        businessEmail: registration.businessEmail,
        businessPhone: registration.businessPhone,
        password: hashedPassword,
        planId: selectedPlan._id,
        planName: selectedPlan.title,
        planPrice: selectedPlan.price,
        razorpayOrderId,
        razorpayPaymentId,
        razorpayPaymentLinkId,
        razorpaySignature,
        paymentMethod: sanitizeText(paymentMeta.paymentMethod || 'Razorpay'),
        paymentStatus: 'Paid',
        subscriptionStatus: 'Pending',
        paidAt: new Date()
    });
    await resolvePendingDuplicatesForPaidRecord(savedRecord);
    return savedRecord;
}

router.get("/plan", async (req, res) => {
    const loginname = req.session.email;
    const Data = await subTable.find();
    res.render("plans.ejs", { Data, loginname });
});

router.get("/addplan", (req, res) => {
    const loginname = req.session.email;
    res.render("Addplan.ejs", { loginname });
});

router.post("/addplan", async (req, res) => {
    const { title, price, features } = req.body;
    const featureArray = JSON.parse(features);

    const subRecord = new subTable({
        title,
        price,
        features: featureArray
    });

    await subRecord.save();
    res.redirect("/plan");
});

router.get("/planstatus/:id/:Status", async (req, res) => {
    const id = req.params.id;
    const CurrentStatus = req.params.Status;
    const newStatus = CurrentStatus === "Pending" ? "Active" : "Pending";
    await subTable.findByIdAndUpdate(id, { Status: newStatus });
    res.redirect("/plan");
});

router.get('/paymentStatus', async (req, res) => {
    const loginname = req.session.email;
    const records = await registerTable.find().sort({ createdAt: -1, _id: -1 });
    const userDetails = hidePendingWhenPaidExists(records);
    res.render('pendingSub.ejs', { userDetails, loginname });
});

router.get('/invoices', logincheck, async (req, res) => {
    const loginname = req.session.email;
    const searchQuery = sanitizeText(req.query.q).toLowerCase();
    const subscriptionStatus = sanitizeText(req.query.status);
    const validStatusOptions = ['Pending', 'Active', 'Cancelled'];
    const statusFilter = validStatusOptions.includes(subscriptionStatus) ? subscriptionStatus : '';

    const paidRecords = await registerTable.find({ paymentStatus: 'Paid' }).sort({ paidAt: -1, createdAt: -1, _id: -1 }).lean();
    const invoices = paidRecords.map((record) => {
        const issuedAt = record.paidAt || record.createdAt;
        return {
            ...record,
            invoiceNo: buildInvoiceNumber(record),
            issuedAt,
            amount: safeAmount(record.planPrice),
            customerName: sanitizeText(record.businessName || record.name || 'Customer'),
            customerEmail: sanitizeText(record.businessEmail || record.email || ''),
            transactionId: sanitizeText(record.razorpayPaymentId || record.razorpayPaymentLinkId || record.razorpayOrderId || buildFallbackTransactionId(record))
        };
    });

    const filteredInvoices = invoices.filter((invoice) => {
        const searchable = [
            invoice.invoiceNo,
            invoice.customerName,
            invoice.customerEmail,
            sanitizeText(invoice.planName),
            sanitizeText(invoice.paymentMethod),
            invoice.transactionId
        ].join(' ').toLowerCase();

        const matchesSearch = !searchQuery || searchable.includes(searchQuery);
        const matchesStatus = !statusFilter || sanitizeText(invoice.subscriptionStatus) === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalRevenue = invoices.reduce((sum, invoice) => sum + safeAmount(invoice.amount), 0);

    res.render('invoices.ejs', {
        loginname,
        invoices: filteredInvoices,
        filters: {
            q: sanitizeText(req.query.q),
            status: statusFilter
        },
        statusOptions: validStatusOptions,
        stats: {
            totalInvoices: invoices.length,
            shownInvoices: filteredInvoices.length,
            totalRevenue,
            pendingActivation: invoices.filter((invoice) => sanitizeText(invoice.subscriptionStatus) === 'Pending').length,
            activeSubscriptions: invoices.filter((invoice) => sanitizeText(invoice.subscriptionStatus) === 'Active').length
        }
    });
});

router.get('/payment-history', logincheck, async (req, res) => {
    const loginname = req.session.email;
    const searchQuery = sanitizeText(req.query.q).toLowerCase();
    const requestedStatus = sanitizeText(req.query.status);
    const requestedMethod = sanitizeText(req.query.method);
    const validStatusOptions = ['Paid', 'Pending', 'Failed'];

    const records = await registerTable.find().sort({ paidAt: -1, createdAt: -1, _id: -1 }).lean();

    const paymentHistory = records.map((record) => {
        const paymentStatus = sanitizeText(record.paymentStatus || 'Pending') || 'Pending';
        const paymentMethod = sanitizeText(record.paymentMethod || 'Not specified') || 'Not specified';
        const transactionAt = record.paidAt || record.createdAt;
        const transactionId = sanitizeText(record.razorpayPaymentId || record.razorpayPaymentLinkId || record.razorpayOrderId || buildFallbackTransactionId(record));

        return {
            ...record,
            amount: safeAmount(record.planPrice),
            paymentStatus,
            paymentMethod,
            transactionAt,
            transactionId,
            customerName: sanitizeText(record.businessName || record.name || 'Customer'),
            customerEmail: sanitizeText(record.businessEmail || record.email || '')
        };
    });

    const methodOptions = [...new Set(paymentHistory.map((record) => record.paymentMethod).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const statusFilter = validStatusOptions.includes(requestedStatus) ? requestedStatus : '';
    const methodFilter = methodOptions.includes(requestedMethod) ? requestedMethod : '';

    const filteredHistory = paymentHistory.filter((record) => {
        const searchable = [
            record.transactionId,
            record.customerName,
            record.customerEmail,
            sanitizeText(record.planName),
            sanitizeText(record.paymentMethod),
            sanitizeText(record.paymentStatus)
        ].join(' ').toLowerCase();

        const matchesSearch = !searchQuery || searchable.includes(searchQuery);
        const matchesStatus = !statusFilter || record.paymentStatus === statusFilter;
        const matchesMethod = !methodFilter || record.paymentMethod === methodFilter;
        return matchesSearch && matchesStatus && matchesMethod;
    });

    const totalCollected = paymentHistory
        .filter((record) => record.paymentStatus === 'Paid')
        .reduce((sum, record) => sum + safeAmount(record.amount), 0);

    const pendingAmount = paymentHistory
        .filter((record) => record.paymentStatus === 'Pending')
        .reduce((sum, record) => sum + safeAmount(record.amount), 0);

    res.render('paymentHistory.ejs', {
        loginname,
        paymentHistory: filteredHistory,
        filters: {
            q: sanitizeText(req.query.q),
            status: statusFilter,
            method: methodFilter
        },
        statusOptions: validStatusOptions,
        methodOptions,
        stats: {
            totalTransactions: paymentHistory.length,
            shownTransactions: filteredHistory.length,
            paidCount: paymentHistory.filter((record) => record.paymentStatus === 'Paid').length,
            pendingCount: paymentHistory.filter((record) => record.paymentStatus === 'Pending').length,
            failedCount: paymentHistory.filter((record) => record.paymentStatus === 'Failed').length,
            totalCollected,
            pendingAmount
        }
    });
});

router.get('/pricingForm', async (req, res) => {
    const loginname = req.session.email;
    const { plans, selectedPlan } = await buildPricingPageData(req.query);
    const razorpayConfig = await getRazorpayConfig();

    res.render('pricingForm.ejs', {
        loginname,
        plans,
        selectedPlan,
        razorpayConfigured: Boolean(razorpayConfig.keyId && razorpayConfig.keySecret),
        success: req.query.success === '1',
        error: sanitizeText(req.query.error)
    });
});

router.post('/pricingForm', async (req, res) => {
    const { selectedPlan } = await buildPricingPageData(req.body);
    const planId = selectedPlan ? `?planId=${selectedPlan._id}&error=${encodeURIComponent('Please complete payment from the checkout button.')}` : `?error=${encodeURIComponent('Please complete payment from the checkout button.')}`;
    res.redirect(`/pricingForm${planId}`);
});

router.post('/subscription/checkout', async (req, res) => {
    try {
        const registration = normalizeRegistrationData(req.body);
        const validationErrors = validateRegistrationData(registration);
        const selectedPlan = await findSelectedPlan(req.body);

        if (validationErrors.length) {
            const planQuery = selectedPlan ? `?planId=${selectedPlan._id}&error=${encodeURIComponent(validationErrors[0])}` : `?error=${encodeURIComponent(validationErrors[0])}`;
            res.redirect(`/pricingForm${planQuery}`);
            return;
        }

        if (!selectedPlan || selectedPlan.Status !== 'Active') {
            res.redirect(`/pricingForm?error=${encodeURIComponent('Selected plan is not available right now.')}`);
            return;
        }

        setCheckoutDraft(req, {
            registration,
            planId: String(selectedPlan._id)
        });

        const pendingRegistration = await createOrRefreshPendingSubscription({
            registration,
            selectedPlan
        });
        req.session.subscriptionCheckoutDraft.pendingRegistrationId = String(pendingRegistration._id);

        await saveSession(req);
        res.redirect('/subscription/payment');
    } catch (error) {
        res.redirect(`/pricingForm?error=${encodeURIComponent(error.message || 'Unable to continue to payment.')}`);
    }
});

router.get('/subscription/payment', async (req, res) => {
    const draft = getCheckoutDraft(req);

    if (!draft || !draft.registration || !draft.planId) {
        res.redirect(`/pricingForm?error=${encodeURIComponent('Please complete the registration form first.')}`);
        return;
    }

    const selectedPlan = await findSelectedPlan({ planId: draft.planId });
    const razorpayConfig = await getRazorpayConfig();

    if (!selectedPlan) {
        req.session.subscriptionCheckoutDraft = null;
        res.redirect(`/pricingForm?error=${encodeURIComponent('Selected plan was not found. Please try again.')}`);
        return;
    }

    res.render('subscriptionCheckout.ejs', {
        loginname: req.session.email,
        registration: draft.registration,
        selectedPlan,
        savedPaymentLink: draft.paymentLink || null,
        razorpayConfigured: Boolean(razorpayConfig.keyId && razorpayConfig.keySecret),
        customUpiPayload: sanitizeText(razorpayConfig.customUpiPayload),
        error: sanitizeText(req.query.error),
        success: req.query.success === '1'
    });
});

router.post('/subscription/create-order', async (req, res) => {
    try {
        const registration = normalizeRegistrationData(req.body);
        const validationErrors = validateRegistrationData(registration);
        const credentialCandidates = await getRazorpayCredentialCandidates();

        if (validationErrors.length) {
            res.status(400).json({ success: false, message: validationErrors[0] });
            return;
        }

        if (!credentialCandidates.length) {
            res.status(400).json({
                success: false,
                message: 'Razorpay payment is not configured yet. Please contact admin.'
            });
            return;
        }

        const selectedPlan = await findSelectedPlan(req.body);

        if (!selectedPlan || selectedPlan.Status !== 'Active') {
            res.status(404).json({ success: false, message: 'Selected plan is not available right now.' });
            return;
        }

        if (!selectedPlan.price || selectedPlan.price <= 0) {
            res.status(400).json({ success: false, message: 'Selected plan price is invalid.' });
            return;
        }

        const pendingRegistration = await createOrRefreshPendingSubscription({
            registration,
            selectedPlan
        });

        const orderResponse = await callRazorpayApiWithCredential({
            path: '/v1/orders',
            method: 'POST',
            payload: {
                amount: Math.round(selectedPlan.price * 100),
                currency: CURRENCY,
                receipt: `sub_${Date.now()}`,
                notes: {
                    planId: String(selectedPlan._id),
                    planName: selectedPlan.title,
                    customerEmail: registration.email,
                    businessName: registration.businessName,
                    pendingRegistrationId: String(pendingRegistration._id)
                }
            }
        });

        setCheckoutDraft(req, {
            registration,
            planId: String(selectedPlan._id),
            pendingRegistrationId: String(pendingRegistration._id),
            paymentLink: getCheckoutDraft(req)?.paymentLink || null
        });
        await saveSession(req);

        res.json({
            success: true,
            keyId: orderResponse.credential.keyId,
            currency: CURRENCY,
            order: orderResponse.data,
            plan: selectedPlan,
            pendingRegistrationId: String(pendingRegistration._id)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Unable to start payment right now.'
        });
    }
});

router.post('/subscription/create-payment-link', async (req, res) => {
    try {
        const registration = normalizeRegistrationData(req.body);
        const validationErrors = validateRegistrationData(registration);
        const credentialCandidates = await getRazorpayCredentialCandidates();
        const preferredUpiApp = sanitizeText(req.body.preferredUpiApp || 'upi');

        if (validationErrors.length) {
            res.status(400).json({ success: false, message: validationErrors[0] });
            return;
        }

        if (!credentialCandidates.length) {
            res.status(400).json({
                success: false,
                message: 'Razorpay payment is not configured yet. Please contact admin.'
            });
            return;
        }

        const selectedPlan = await findSelectedPlan(req.body);

        if (!selectedPlan || selectedPlan.Status !== 'Active') {
            res.status(404).json({ success: false, message: 'Selected plan is not available right now.' });
            return;
        }

        const pendingRegistration = await createOrRefreshPendingSubscription({
            registration,
            selectedPlan
        });

        setCheckoutDraft(req, {
            registration,
            planId: String(selectedPlan._id),
            pendingRegistrationId: String(pendingRegistration._id),
            paymentLink: getCheckoutDraft(req)?.paymentLink || null
        });

        const draft = getCheckoutDraft(req);
        if (draft?.paymentLink?.id && draft?.paymentLink?.shortUrl) {
            try {
                const existingLink = await callRazorpayApi({
                    path: `/v1/payment_links/${draft.paymentLink.id}`,
                    method: 'GET',
                    preferredKeyId: draft.paymentLink.keyId
                });
                const existingStatus = sanitizeText(existingLink.status).toLowerCase();

                if (!['cancelled', 'expired', 'paid'].includes(existingStatus)) {
                    setCheckoutDraftPaymentLink(req, {
                        ...existingLink,
                        keyId: draft.paymentLink.keyId || ''
                    });
                    await saveSession(req);

                    res.json({
                        success: true,
                        paymentLink: existingLink
                    });
                    return;
                }
            } catch (error) {
                req.session.subscriptionCheckoutDraft.paymentLink = null;
                await saveSession(req);
            }
        }

        const paymentLinkResponse = await callRazorpayApiWithCredential({
            path: '/v1/payment_links',
            method: 'POST',
            payload: {
                amount: Math.round(selectedPlan.price * 100),
                currency: CURRENCY,
                accept_partial: false,
                expire_by: Math.floor(Date.now() / 1000) + (30 * 60),
                description: `${selectedPlan.title} subscription payment`,
                reference_id: `sub_link_${Date.now()}`,
                customer: {
                    name: registration.name,
                    email: registration.email,
                    contact: registration.phone
                },
                notify: {
                    sms: false,
                    email: false
                },
                reminder_enable: false,
                notes: {
                    planId: String(selectedPlan._id),
                    planName: selectedPlan.title,
                    businessName: registration.businessName,
                    paymentMode: 'upi_qr',
                    preferredUpiApp,
                    pendingRegistrationId: String(pendingRegistration._id)
                }
            }
        });

        const paymentLink = {
            ...paymentLinkResponse.data,
            keyId: paymentLinkResponse.credential.keyId
        };

        setCheckoutDraftPaymentLink(req, paymentLink);
        await saveSession(req);

        res.json({
            success: true,
            paymentLink: paymentLinkResponse.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Unable to create a scan payment link right now.'
        });
    }
});

router.get('/subscription/payment-link-status/:id', async (req, res) => {
    try {
        const draft = getCheckoutDraft(req);

        if (!draft || !draft.registration || !draft.planId) {
            res.status(400).json({
                success: false,
                message: 'Your payment session has expired. Please restart the subscription form.'
            });
            return;
        }

        const paymentLinkId = sanitizeText(req.params.id);
        if (!paymentLinkId) {
            res.status(400).json({ success: false, message: 'Payment link ID is missing.' });
            return;
        }

        const selectedPlan = await findSelectedPlan({ planId: draft.planId });
        if (!selectedPlan) {
            res.status(404).json({ success: false, message: 'Selected plan was not found.' });
            return;
        }

        const paymentLink = await callRazorpayApi({
            path: `/v1/payment_links/${paymentLinkId}`,
            method: 'GET',
            preferredKeyId: sanitizeText(draft.paymentLink?.keyId)
        });

        const paymentStatus = sanitizeText(paymentLink.status).toLowerCase();

        if (paymentStatus === 'paid') {
            await finalizeSubscriptionPayment({
                registration: draft.registration,
                selectedPlan,
                paymentMeta: {
                    razorpayPaymentLinkId: paymentLink.id,
                    razorpayPaymentId: sanitizeText(paymentLink.payment_id || paymentLinkId),
                    paymentMethod: 'UPI QR (PhonePe / GPay / Paytm via Razorpay)',
                    pendingRegistrationId: sanitizeText(draft.pendingRegistrationId)
                }
            });

            req.session.subscriptionCheckoutDraft = null;
            await saveSession(req);

            res.json({
                success: true,
                status: 'paid',
                redirectUrl: `/pricingForm?planId=${selectedPlan._id}&success=1`
            });
            return;
        }

        res.json({
            success: true,
            status: paymentStatus || 'created',
            paymentLink: {
                id: paymentLink.id,
                short_url: paymentLink.short_url,
                amount: paymentLink.amount,
                amount_paid: paymentLink.amount_paid
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Unable to check scan payment status right now.'
        });
    }
});

router.post('/subscription/verify-payment', async (req, res) => {
    try {
        const registration = normalizeRegistrationData(req.body.registration);
        const validationErrors = validateRegistrationData(registration);

        if (validationErrors.length) {
            res.status(400).json({ success: false, message: validationErrors[0] });
            return;
        }

        const selectedPlan = await findSelectedPlan({
            planId: req.body.planId,
            plan: req.body.plan,
            price: req.body.price
        });

        if (!selectedPlan) {
            res.status(404).json({ success: false, message: 'Selected plan was not found.' });
            return;
        }

        const razorpayOrderId = sanitizeText(req.body.razorpay_order_id);
        const razorpayPaymentId = sanitizeText(req.body.razorpay_payment_id);
        const razorpaySignature = sanitizeText(req.body.razorpay_signature);
        const draft = getCheckoutDraft(req);
        const pendingRegistrationId = sanitizeText(req.body.pendingRegistrationId || draft?.pendingRegistrationId);
        const credentialCandidates = await getRazorpayCredentialCandidates();

        if (!credentialCandidates.length) {
            res.status(500).json({ success: false, message: 'Razorpay payment settings are missing on the server.' });
            return;
        }

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            res.status(400).json({ success: false, message: 'Payment verification details are incomplete.' });
            return;
        }

        const isSignatureValid = credentialCandidates.some((candidate) => {
            const expectedSignature = crypto
                .createHmac('sha256', candidate.keySecret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest('hex');
            return expectedSignature === razorpaySignature;
        });

        if (!isSignatureValid) {
            res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
            return;
        }

        await finalizeSubscriptionPayment({
            registration,
            selectedPlan,
            paymentMeta: {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                paymentMethod: 'Razorpay Checkout',
                pendingRegistrationId
            }
        });

        req.session.subscriptionCheckoutDraft = null;
        await saveSession(req);

        res.json({
            success: true,
            redirectUrl: `/pricingForm?planId=${selectedPlan._id}&success=1`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Unable to verify payment right now.'
        });
    }
});

router.get('/subscription/settings', logincheck, async (req, res) => {
    const loginname = req.session.email;
    const razorpayConfig = await getRazorpayConfig();

    res.render('RazorpaySettings.ejs', {
        loginname,
        success: req.query.success === '1',
        error: sanitizeText(req.query.error),
        config: {
            keyId: razorpayConfig.keyId,
            hasSecret: Boolean(razorpayConfig.keySecret),
            maskedSecret: maskSecret(razorpayConfig.keySecret),
            customUpiPayload: sanitizeText(razorpayConfig.customUpiPayload),
            source: razorpayConfig.source,
            updatedAt: razorpayConfig.updatedAt,
            updatedBy: razorpayConfig.updatedBy
        }
    });
});

router.post('/subscription/settings', logincheck, async (req, res) => {
    try {
        const submittedKeyId = normalizeCredential(req.body.keyId);
        const submittedKeySecret = normalizeCredential(req.body.keySecret);
        const customUpiPayload = sanitizeText(req.body.customUpiPayload);
        const existingConfig = await paymentGatewaySettingTable.findOne({ provider: 'razorpay' }).sort({ updatedAt: -1, _id: -1 });
        const existingKeyId = normalizeCredential(existingConfig?.keyId);
        const existingKeySecret = normalizeCredential(existingConfig?.keySecret);
        const keyId = submittedKeyId || existingKeyId;
        const keySecretToSave = submittedKeySecret || existingKeySecret;
        const isCredentialUpdate = Boolean(submittedKeySecret) || Boolean(submittedKeyId && submittedKeyId !== existingKeyId);

        if (!keyId || !keySecretToSave) {
            res.redirect('/subscription/settings?error=' + encodeURIComponent('Razorpay Key ID and Key Secret are required at least once before using Razorpay checkout.'));
            return;
        }

        if (!/^rzp_(test|live)_[A-Za-z0-9]+$/i.test(keyId)) {
            res.redirect('/subscription/settings?error=' + encodeURIComponent('Invalid Razorpay Key ID format. Paste only the value like rzp_test_xxxxx.'));
            return;
        }

        if (isCredentialUpdate) {
            try {
                await executeRazorpayApiRequest({
                    keyId,
                    keySecret: keySecretToSave,
                    path: '/v1/orders?count=1',
                    method: 'GET'
                });
            } catch (error) {
                const friendlyError = toRazorpayFriendlyError(error);
                res.redirect('/subscription/settings?error=' + encodeURIComponent(friendlyError.message || 'Invalid Razorpay credentials.'));
                return;
            }
        }

        await paymentGatewaySettingTable.findOneAndUpdate(
            { provider: 'razorpay' },
            {
                provider: 'razorpay',
                displayName: 'Razorpay',
                keyId,
                keySecret: keySecretToSave,
                customUpiPayload,
                isActive: true,
                updatedBy: req.session.email || 'Admin'
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
                sort: { updatedAt: -1, _id: -1 }
            }
        );

        res.redirect('/subscription/settings?success=1');
    } catch (error) {
        res.redirect('/subscription/settings?error=' + encodeURIComponent(error.message || 'Unable to save Razorpay settings.'));
    }
});

module.exports = router;