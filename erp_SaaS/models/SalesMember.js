const mongoose = require("mongoose")

const salesMemberSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            default: "",
            trim: true
        },
        region: {
            type: String,
            default: "",
            trim: true
        },
        monthlyTarget: {
            type: Number,
            default: 0
        },
        commissionRate: {
            type: Number,
            default: 5
        },
        status: {
            type: String,
            enum: ["Active", "On Leave", "Inactive"],
            default: "Active"
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("SalesMember", salesMemberSchema)
