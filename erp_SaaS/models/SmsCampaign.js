const mongoose = require("mongoose")

const smsCampaignSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Template", "Campaign", "Log"],
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        audience: {
            type: String,
            default: "",
            trim: true
        },
        content: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["Draft", "Scheduled", "Sent", "Delivered", "Failed"],
            default: "Draft"
        },
        scheduledAt: {
            type: Date,
            default: null
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("SmsCampaign", smsCampaignSchema)
