const mongoose = require("mongoose")

const businessLeadSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        company: {
            type: String,
            default: "",
            trim: true
        },
        email: {
            type: String,
            default: "",
            trim: true
        },
        phone: {
            type: String,
            default: "",
            trim: true
        },
        source: {
            type: String,
            default: "Website",
            trim: true
        },
        stage: {
            type: String,
            enum: ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
            default: "New"
        },
        score: {
            type: Number,
            default: 50
        },
        estimatedValue: {
            type: Number,
            default: 0
        },
        assignedTo: {
            type: String,
            default: "",
            trim: true
        },
        nextFollowUp: {
            type: Date,
            default: null
        },
        notes: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["Open", "Contacted", "Converted", "Dormant"],
            default: "Open"
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("BusinessLead", businessLeadSchema)
