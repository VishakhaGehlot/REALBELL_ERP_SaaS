const mongoose = require("mongoose")

const salesTargetSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        owner: {
            type: String,
            required: true,
            trim: true
        },
        period: {
            type: String,
            required: true,
            trim: true
        },
        targetAmount: {
            type: Number,
            default: 0
        },
        achievedAmount: {
            type: Number,
            default: 0
        },
        category: {
            type: String,
            default: "Revenue",
            trim: true
        },
        status: {
            type: String,
            enum: ["On Track", "At Risk", "Achieved"],
            default: "On Track"
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("SalesTarget", salesTargetSchema)
