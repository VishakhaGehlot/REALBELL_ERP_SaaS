const mongoose = require("mongoose")

const invoiceItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true }
})

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: { type: String, required: true, unique: true },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
        
        // Customer Info
        customerName: { type: String, required: true },
        customerEmail: { type: String },
        customerPhone: { type: String },
        customerAddress: { type: String },
        customerGstNumber: { type: String },
        
        // Invoice Dates
        invoiceDate: { type: Date, default: Date.now },
        dueDate: { type: Date },
        
        // Items
        items: [invoiceItemSchema],
        
        // Totals
        subtotal: { type: Number, required: true, default: 0 },
        totalDiscount: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 },
        
        // Payment Info
        paymentStatus: { 
            type: String, 
            enum: ["Draft", "Sent", "Paid", "Partial", "Overdue", "Cancelled"], 
            default: "Draft" 
        },
        paymentMethod: { type: String, enum: ["Cash", "Card", "Bank Transfer", "UPI", "Cheque", "Other"], default: "Other" },
        paidAmount: { type: Number, default: 0 },
        balanceAmount: { type: Number, default: 0 },
        
        // Notes & Terms
        notes: { type: String },
        termsAndConditions: { type: String },
        
        // Meta
        createdBy: { type: String },
        updatedBy: { type: String },
        sentAt: { type: Date },
        paidAt: { type: Date }
    },
    { timestamps: true }
)

// Generate unique invoice number
invoiceSchema.pre("save", async function(next) {
    if (!this.invoiceNumber) {
        const date = new Date()
        const year = date.getFullYear().toString().slice(-2)
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const count = await mongoose.model("Invoice").countDocuments({
            invoiceDate: { $gte: new Date(date.getFullYear(), date.getMonth(), 1) }
        })
        this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, "0")}`
    }
    next()
})

// Calculate totals before save
invoiceSchema.pre("save", function(next) {
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
        this.totalDiscount = this.items.reduce((sum, item) => sum + ((item.quantity * item.unitPrice) * (item.discount / 100)), 0)
        this.totalTax = this.items.reduce((sum, item) => sum + item.taxAmount, 0)
        this.totalAmount = this.subtotal - this.totalDiscount + this.totalTax
        this.balanceAmount = this.totalAmount - this.paidAmount
    }
    next()
})

module.exports = mongoose.model("Invoice", invoiceSchema)
