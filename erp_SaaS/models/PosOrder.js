const mongoose = require("mongoose")

const orderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "product",
            default: null
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
)

const posOrderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        customerName: {
            type: String,
            required: true,
            trim: true
        },
        items: {
            type: [orderItemSchema],
            default: []
        },
        subtotal: {
            type: Number,
            default: 0
        },
        taxPercent: {
            type: Number,
            default: 0
        },
        taxAmount: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            default: 0
        },
        paymentStatus: {
            type: String,
            enum: ["Paid", "Pending", "Partial"],
            default: "Paid"
        },
        salesOwner: {
            type: String,
            default: "",
            trim: true
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

module.exports = mongoose.model("PosOrder", posOrderSchema)
