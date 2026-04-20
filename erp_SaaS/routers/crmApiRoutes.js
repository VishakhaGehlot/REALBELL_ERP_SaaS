const router = require("express").Router();
const crmController = require("../controllers/crmApiController");
const { requireAuth } = require("../middleware/roleAuth");
const { requireModuleAccess } = require("../middleware/permissionAuth");

router.use(requireAuth);

// Leads API
router.get("/leads", requireModuleAccess("leadManagement", "view"), crmController.getAllLeads);
router.post("/leads", requireModuleAccess("leadManagement", "add"), crmController.createLead);
router.put("/leads/:id/status", requireModuleAccess("leadManagement", "edit"), crmController.updateLeadStatus);
router.put("/leads/:id", requireModuleAccess("leadManagement", "edit"), crmController.editLead);
router.delete("/leads/:id", requireModuleAccess("leadManagement", "delete"), crmController.deleteLead);

// Deals API
router.get("/deals", requireModuleAccess("dealManagement", "view"), crmController.getAllDeals);
router.post("/deals", requireModuleAccess("dealManagement", "add"), crmController.createDeal);
router.put("/deals/:id/stage", requireModuleAccess("dealManagement", "edit"), crmController.updateDealStage);
router.put("/deals/:id", requireModuleAccess("dealManagement", "edit"), crmController.editDeal);
router.delete("/deals/:id", requireModuleAccess("dealManagement", "delete"), crmController.deleteDeal);
router.post("/deals/:id/generate-document", requireModuleAccess("dealManagement", "edit"), crmController.generateDealDocument);

// Analytics API
router.get("/analytics", requireModuleAccess("crm", "view"), crmController.getAnalytics);

module.exports = router;
