const CrmLead = require("../models/CrmLead");
const CrmDeal = require("../models/CrmDeal");
const CrmActivity = require("../models/CrmActivity");
const { normalizeRole } = require("../middleware/roleAuth");

function getSessionIdentity(req) {
    const userId = req.session && req.session.userId ? req.session.userId : null;
    const fullName = String(req.session && req.session.userName ? req.session.userName : "").trim();
    const exactEmail = String(req.session && req.session.email ? req.session.email : "").trim();
    const normalizedEmail = exactEmail.toLowerCase();
    const emailValues = Array.from(new Set([exactEmail, normalizedEmail].filter(Boolean)));

    return {
        userId,
        fullName,
        exactEmail,
        normalizedEmail,
        emailValues
    };
}

function buildScopedCrmFilter(req, { idFields = [], emailFields = [], legacyMatchers = [] } = {}, baseFilter = {}) {

    const identity = getSessionIdentity(req);
    const clauses = [];

    if (identity.userId) {
        for (const field of idFields) {
            clauses.push({ [field]: identity.userId });
        }
    }

    for (const field of emailFields) {
        for (const value of identity.emailValues) {
            clauses.push({ [field]: value });
        }
    }

    for (const matcher of legacyMatchers) {
        const field = matcher && matcher.field;
        const values = Array.isArray(matcher && matcher.values) ? matcher.values : [];

        for (const value of values) {
            if (field && value) {
                clauses.push({ [field]: value });
            }
        }
    }

    if (!clauses.length) {
        if (!baseFilter || !Object.keys(baseFilter).length) {
            return { _id: null };
        }

        return {
            $and: [
                baseFilter,
                { _id: null }
            ]
        };
    }

    if (!baseFilter || !Object.keys(baseFilter).length) {
        return { $or: clauses };
    }

    return {
        $and: [
            baseFilter,
            { $or: clauses }
        ]
    };
}

function buildLeadScopeFilter(req, baseFilter = {}) {
    const identity = getSessionIdentity(req);
    return buildScopedCrmFilter(
        req,
        {
            idFields: ["createdByUserId"],
            emailFields: ["createdByEmail"],
            legacyMatchers: [
                {
                    field: "assignedTo",
                    values: [identity.fullName, ...identity.emailValues]
                }
            ]
        },
        baseFilter
    );
}

function buildDealScopeFilter(req, baseFilter = {}) {
    const identity = getSessionIdentity(req);
    return buildScopedCrmFilter(
        req,
        {
            idFields: ["createdByUserId"],
            emailFields: ["createdByEmail"],
            legacyMatchers: [
                {
                    field: "owner",
                    values: [identity.fullName, ...identity.emailValues]
                }
            ]
        },
        baseFilter
    );
}

// ----- LEADS -----
exports.getAllLeads = async (req, res) => {
    try {
        const leads = await CrmLead.find(buildLeadScopeFilter(req)).sort({ createdAt: -1 });
        res.status(200).json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createLead = async (req, res) => {
    try {
        const { name, email, phone, source, assignedTo, score, status } = req.body;
        const identity = getSessionIdentity(req);

        const lead = new CrmLead({
            name,
            email,
            phone,
            source: source || "Website",
            assignedTo: assignedTo || "Unassigned",
            score: score || 50,
            status: status || "New",
            createdByUserId: identity.userId || null,
            createdByEmail: identity.normalizedEmail
        });
        await lead.save();

        await new CrmActivity({
            type: "Note",
            description: "Lead automatically captured via " + (source || "Website"),
            referenceModel: "CrmLead",
            referenceId: lead._id
        }).save();

        res.status(201).json(lead);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, score } = req.body;
        const updated = await CrmLead.findOneAndUpdate(
            buildLeadScopeFilter(req, { _id: id }),
            { status, score },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Lead not found" });
        }

        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.editLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, source, status, score, assignedTo } = req.body;
        const updated = await CrmLead.findOneAndUpdate(
            buildLeadScopeFilter(req, { _id: id }),
            { name, email, phone, source, status, score, assignedTo },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Lead not found" });
        }

        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.generateDealDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const deal = await CrmDeal.findOne(buildDealScopeFilter(req, { _id: id })).populate("leadId");
        if (!deal) return res.status(404).json({ error: "Deal not found" });

        await new CrmActivity({
            type: "Note",
            description: "Proposal/Quote Document generated and sent to " + (deal.leadId ? deal.leadId.email : "client"),
            referenceModel: "CrmDeal",
            referenceId: deal._id
        }).save();

        res.status(200).json({ message: "Document generated and sent successfully", deal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await CrmLead.findOne(buildLeadScopeFilter(req, { _id: id }));

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        await CrmDeal.deleteMany(buildDealScopeFilter(req, { leadId: lead._id }));
        await CrmLead.deleteOne({ _id: lead._id });
        res.status(200).json({ message: "Lead deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----- DEALS -----
exports.getAllDeals = async (req, res) => {
    try {
        const deals = await CrmDeal.find(buildDealScopeFilter(req)).populate("leadId").sort({ createdAt: -1 });
        res.status(200).json(deals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createDeal = async (req, res) => {
    try {
        const { title, value, leadId, expectedCloseDate } = req.body;
        const identity = getSessionIdentity(req);
        const lead = await CrmLead.findOne(buildLeadScopeFilter(req, { _id: leadId }));

        if (!lead) {
            return res.status(404).json({ error: "Lead not found" });
        }

        const deal = new CrmDeal({
            title,
            value,
            leadId,
            expectedCloseDate,
            owner: identity.exactEmail || identity.fullName || "",
            createdByUserId: identity.userId || null,
            createdByEmail: identity.normalizedEmail
        });
        await deal.save();

        await new CrmActivity({
            type: "Note",
            description: "New deal created.",
            referenceModel: "CrmDeal",
            referenceId: deal._id
        }).save();

        res.status(201).json(deal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateDealStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;
        const deal = await CrmDeal.findOneAndUpdate(
            buildDealScopeFilter(req, { _id: id }),
            { stage },
            { new: true }
        );

        if (!deal) {
            return res.status(404).json({ error: "Deal not found" });
        }

        if (stage === "Closed Won") {
            console.log(`[Automation] Email Triggered: Deal ${deal.title} won!`);
        }

        await new CrmActivity({
            type: "Note",
            description: "Deal moved to stage: " + stage,
            referenceModel: "CrmDeal",
            referenceId: deal._id
        }).save();

        res.status(200).json(deal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.editDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, value, leadId } = req.body;
        const lead = await CrmLead.findOne(buildLeadScopeFilter(req, { _id: leadId }));

        if (!lead) {
            return res.status(404).json({ error: "Lead not found" });
        }

        const deal = await CrmDeal.findOneAndUpdate(
            buildDealScopeFilter(req, { _id: id }),
            { title, value, leadId },
            { new: true }
        );

        if (!deal) {
            return res.status(404).json({ error: "Deal not found" });
        }

        res.status(200).json(deal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteDeal = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await CrmDeal.findOneAndDelete(buildDealScopeFilter(req, { _id: id }));

        if (!deleted) {
            return res.status(404).json({ message: "Deal not found" });
        }

        res.status(200).json({ message: "Deal deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----- ANALYTICS -----
exports.getAnalytics = async (req, res) => {
    try {
        const leadScope = buildLeadScopeFilter(req);
        const dealScope = buildDealScopeFilter(req);
        const totalLeads = await CrmLead.countDocuments(leadScope);
        const totalDeals = await CrmDeal.countDocuments(dealScope);

        const pipelineStages = await CrmDeal.aggregate([
            { $match: dealScope },
            { $group: { _id: "$stage", count: { $sum: 1 }, totalValue: { $sum: "$value" } } }
        ]);

        const conversions = await CrmDeal.countDocuments(buildDealScopeFilter(req, { stage: "Closed Won" }));
        const conversionRate = totalDeals > 0 ? (conversions / totalDeals) * 100 : 0;

        res.status(200).json({
            totalLeads,
            totalDeals,
            pipelineStages,
            conversionRate: conversionRate.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
