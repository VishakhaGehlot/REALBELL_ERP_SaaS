const mongoose = require("mongoose")

const securityRecordSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Security", "System", "Settings"],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            default: "",
            trim: true
        },
        value: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["Enabled", "Disabled", "Review", "Active"],
            default: "Active"
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

module.exports = mongoose.model("SecurityRecord", securityRecordSchema)
