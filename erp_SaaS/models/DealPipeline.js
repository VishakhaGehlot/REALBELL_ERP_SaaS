const mongoose = require("mongoose")

const dealPipelineSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        company: {
            type: String,
            default: "",
            trim: true
        },
        owner: {
            type: String,
            default: "",
            trim: true
        },
        value: {
            type: Number,
            default: 0
        },
        stage: {
            type: String,
            enum: ["Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"],
            default: "Discovery"
        },
        expectedCloseDate: {
            type: Date,
            default: null
        },
        notes: {
            type: String,
            default: "",
            trim: true
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("DealPipeline", dealPipelineSchema)
