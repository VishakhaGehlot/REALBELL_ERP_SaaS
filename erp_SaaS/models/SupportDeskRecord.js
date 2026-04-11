const mongoose = require("mongoose")

const supportDeskRecordSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Ticket", "Knowledge", "Chat"],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        customerName: {
            type: String,
            default: "",
            trim: true
        },
        category: {
            type: String,
            default: "",
            trim: true
        },
        content: {
            type: String,
            default: "",
            trim: true
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium"
        },
        status: {
            type: String,
            enum: ["Open", "In Progress", "Resolved", "Published", "Active"],
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

module.exports = mongoose.model("SupportDeskRecord", supportDeskRecordSchema)
