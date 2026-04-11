const mongoose = require("mongoose")

const accountingEntrySchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Ledger", "Expense", "Tax"],
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
        amount: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ["Draft", "Posted", "Paid", "Pending"],
            default: "Pending"
        },
        entryDate: {
            type: Date,
            default: Date.now
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

module.exports = mongoose.model("AccountingEntry", accountingEntrySchema)
