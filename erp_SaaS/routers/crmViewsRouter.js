const router = require("express").Router();
const CrmLead = require("../models/CrmLead");
const { requireAuth, normalizeRole } = require("../middleware/roleAuth");
const { requireModuleAccess } = require("../middleware/permissionAuth");

function buildOwnedCrmFilter(req, { idFields = [], emailFields = [], legacyMatchers = [] } = {}, baseFilter = {}) {
    if (normalizeRole(req.session && req.session.userRole) === "SuperAdmin") {
        return baseFilter;
    }

    const userId = req.session && req.session.userId ? req.session.userId : null;
    const fullName = String(req.session && req.session.userName ? req.session.userName : "").trim();
    const exactEmail = String(req.session && req.session.email ? req.session.email : "").trim();
    const emailValues = Array.from(new Set([exactEmail, exactEmail.toLowerCase()].filter(Boolean)));
    const clauses = [];

    if (userId) {
        for (const field of idFields) {
            clauses.push({ [field]: userId });
        }
    }

    for (const field of emailFields) {
        for (const value of emailValues) {
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

router.use(requireAuth);

router.get("/crm/leads", requireModuleAccess("leadManagement", "view"), async (req, res) => {
    const loginname = req.session.email;
    const Auth = require("../models/auth");
    const users = await Auth.find().select("firstName lastName _id");
    res.render("CRM/LeadManagement.ejs", { loginname, users });
});

router.get("/crm/deals", requireModuleAccess("dealManagement", "view"), async (req, res) => {
    const loginname = req.session.email;
    const leads = await CrmLead.find(buildOwnedCrmFilter(req, {
        idFields: ["createdByUserId"],
        emailFields: ["createdByEmail"],
        legacyMatchers: [
            {
                field: "assignedTo",
                values: [req.session.userName, req.session.email, String(req.session.email || "").toLowerCase()]
            }
        ]
    })).sort({ createdAt: -1 });
    res.render("CRM/DealPipeline.ejs", { loginname, leads });
});

router.get("/crm/dashboard", requireModuleAccess("crm", "view"), async (req, res) => {
    const loginname = req.session.email;
    res.render("CRM/AnalyticsDashboard.ejs", { loginname });
});

module.exports = router;
