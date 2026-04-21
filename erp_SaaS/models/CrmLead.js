const mongoose = require("mongoose");

const crmLeadSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true },
        phone: { type: String, default: "", trim: true },
        source: {
            type: String,
            enum: ["Website", "Referral", "Cold Call", "Campaign", "Other"],
            default: "Website"
        },
        status: {
            type: String,
            enum: ["New", "Contacted", "Qualified", "Lost"],
            default: "New"
        },
        assignedTo: { type: String, default: "" }, // Could be a sales user ID
        score: { type: Number, default: 0 }, // Lead scoring logic value
        createdByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "auth",
            default: null
        },
        createdByEmail: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CrmLead", crmLeadSchema);
