const mongoose = require("mongoose");

const crmActivitySchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Note", "Meeting", "Call", "Task"],
            required: true
        },
        description: { type: String, required: true },
        date: { type: Date, default: Date.now },
        referenceModel: {
            type: String,
            enum: ["CrmLead", "CrmDeal"],
            required: true
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "referenceModel"
        },
        performedBy: { type: String, default: "System/User" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CrmActivity", crmActivitySchema);
