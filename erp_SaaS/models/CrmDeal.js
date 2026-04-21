const mongoose = require("mongoose");

const crmDealSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        value: { type: Number, required: true, default: 0 },
        stage: {
            type: String,
            enum: ["Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"],
            default: "Discovery"
        },
        leadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CrmLead",
            required: true
        },
        expectedCloseDate: { type: Date, default: null },
        owner: { type: String, default: "" }, // Deal owner
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

module.exports = mongoose.model("CrmDeal", crmDealSchema);
