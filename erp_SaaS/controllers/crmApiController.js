const CrmLead = require("../models/CrmLead");
const CrmDeal = require("../models/CrmDeal");
const CrmActivity = require("../models/CrmActivity");

// ----- LEADS -----
exports.getAllLeads = async (req, res) => {
    try {
        const leads = await CrmLead.find().sort({ createdAt: -1 });
        res.status(200).json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createLead = async (req, res) => {
    try {
        const { name, email, phone, source, assignedTo, score, status } = req.body;
        
        const lead = new CrmLead({ 
            name, 
            email, 
            phone, 
            source: source || 'Website', 
            assignedTo: assignedTo || 'Unassigned', 
            score: score || 50,
            status: status || 'New'
        });
        await lead.save();

        // Log Activity
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
        const updated = await CrmLead.findByIdAndUpdate(id, { status, score }, { returnDocument: 'after' });
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.editLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, source, status, score, assignedTo } = req.body;
        const updated = await CrmLead.findByIdAndUpdate(id, { name, email, phone, source, status, score, assignedTo }, { returnDocument: 'after' });
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.generateDealDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const deal = await CrmDeal.findById(id).populate('leadId');
        if (!deal) return res.status(404).json({ error: "Deal not found" });

        // Simulating document generation
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
        // Delete all deals associated with this lead
        await CrmDeal.deleteMany({ leadId: id });
        await CrmLead.findByIdAndDelete(id);
        res.status(200).json({ message: "Lead deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----- DEALS -----
exports.getAllDeals = async (req, res) => {
    try {
        const deals = await CrmDeal.find().populate("leadId").sort({ createdAt: -1 });
        res.status(200).json(deals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createDeal = async (req, res) => {
    try {
        const { title, value, leadId, expectedCloseDate } = req.body;
        const deal = new CrmDeal({ title, value, leadId, expectedCloseDate });
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
        const deal = await CrmDeal.findByIdAndUpdate(id, { stage }, { returnDocument: 'after' });
        
        // Email automation logic (simulated for now, can use nodemailer)
        if (stage === "Closed Won") {
             // System logic to trigger email notification
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
        const deal = await CrmDeal.findByIdAndUpdate(id, { title, value, leadId }, { returnDocument: 'after' });
        res.status(200).json(deal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteDeal = async (req, res) => {
    try {
        const { id } = req.params;
        await CrmDeal.findByIdAndDelete(id);
        res.status(200).json({ message: "Deal deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----- ANALYTICS -----
exports.getAnalytics = async (req, res) => {
    try {
        const totalLeads = await CrmLead.countDocuments();
        const totalDeals = await CrmDeal.countDocuments();
        
        const pipelineStages = await CrmDeal.aggregate([
            { $group: { _id: "$stage", count: { $sum: 1 }, totalValue: { $sum: "$value" } } }
        ]);

        const conversions = await CrmDeal.countDocuments({ stage: "Closed Won" });
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
