const router = require("express").Router();
const CrmLead = require("../models/CrmLead");
const { requireAuth } = require("../middleware/roleAuth");
const { requireModuleAccess } = require("../middleware/permissionAuth");

router.use(requireAuth);

router.get("/crm/leads", requireModuleAccess("leadManagement", "view"), async (req, res) => {
    const loginname = req.session.email;
    const Auth = require('../models/auth');
    const users = await Auth.find().select('firstName lastName _id');
    res.render("CRM/LeadManagement.ejs", { loginname, users });
});

router.get("/crm/deals", requireModuleAccess("dealManagement", "view"), async (req, res) => {
    const loginname = req.session.email;
    const leads = await CrmLead.find(); // for the Add Deal dropdown
    res.render("CRM/DealPipeline.ejs", { loginname, leads });
});

router.get("/crm/dashboard", requireModuleAccess("crm", "view"), async (req, res) => {
    const loginname = req.session.email;
    res.render("CRM/AnalyticsDashboard.ejs", { loginname });
});

module.exports = router;
