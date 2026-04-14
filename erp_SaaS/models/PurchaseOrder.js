const mongoose = require("mongoose")

const poItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
    pendingQty: { type: Number, default: 0 }
})

const purchaseOrderSchema = new mongoose.Schema(
    {
        poNumber: { type: String, required: true, unique: true },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
        
        // Vendor Info
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
        vendorName: { type: String, required: true },
        vendorEmail: { type: String },
        vendorPhone: { type: String },
        vendorAddress: { type: String },
        vendorGstNumber: { type: String },
        
        // PO Dates
        poDate: { type: Date, default: Date.now },
        expectedDeliveryDate: { type: Date },
        actualDeliveryDate: { type: Date },
        
        // Items
        items: [poItemSchema],
        
        // Totals
        subtotal: { type: Number, required: true, default: 0 },
        totalDiscount: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 },
        
        // Status & Delivery
        status: { 
            type: String, 
            enum: ["Draft", "Sent", "Acknowledged", "Partially Received", "Received", "Cancelled", "Closed"], 
            default: "Draft" 
        },
        deliveryStatus: {
            type: String,
            enum: ["Pending", "In Transit", "Delivered", "Partial"],
            default: "Pending"
        },
        
        // Payment
        paymentTerms: { type: String, default: "Net 30" },
        paymentStatus: { 
            type: String, 
            enum: ["Pending", "Partial", "Paid"], 
            default: "Pending" 
        },
        paidAmount: { type: Number, default: 0 },
        
        // Notes
        notes: { type: String },
        termsAndConditions: { type: String },
        
        // Meta
        createdBy: { type: String },
        updatedBy: { type: String },
        sentAt: { type: Date },
        receivedAt: { type: Date }
    },
    { timestamps: true }
)

// Generate unique PO number
purchaseOrderSchema.pre("save", async function(next) {
    if (!this.poNumber) {
        const date = new Date()
        const year = date.getFullYear().toString().slice(-2)
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const count = await mongoose.model("PurchaseOrder").countDocuments({
            poDate: { $gte: new Date(date.getFullYear(), date.getMonth(), 1) }
        })
        this.poNumber = `PO-${year}${month}-${String(count + 1).padStart(4, "0")}`
    }
    next()
})

// Calculate totals before save
purchaseOrderSchema.pre("save", function(next) {
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
        this.totalDiscount = this.items.reduce((sum, item) => sum + ((item.quantity * item.unitPrice) * (item.discount / 100)), 0)
        this.totalTax = this.items.reduce((sum, item) => sum + item.taxAmount, 0)
        this.totalAmount = this.subtotal - this.totalDiscount + this.totalTax
        
        // Update pending quantities
        this.items.forEach(item => {
            item.pendingQty = item.quantity - (item.receivedQty || 0)
        })
    }
    
    // Auto-update delivery status
    if (this.items && this.items.length > 0) {
        const totalPending = this.items.reduce((sum, item) => sum + (item.pendingQty || 0), 0)
        const totalQty = this.items.reduce((sum, item) => sum + item.quantity, 0)
        
        if (totalPending === 0) {
            this.deliveryStatus = "Delivered"
            this.status = "Received"
        } else if (totalPending < totalQty) {
            this.deliveryStatus = "Partial"
            this.status = "Partially Received"
        }
    }
    
    next()
})

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema)
