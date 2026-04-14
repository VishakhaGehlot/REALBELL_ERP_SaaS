const mongoose = require("mongoose")

const vendorSchema = new mongoose.Schema(
    {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
        
        // Basic Info
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String },
        
        // Address
        address: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
        country: { type: String, default: "India" },
        
        // Business Info
        gstNumber: { type: String },
        panNumber: { type: String },
        businessType: { type: String, enum: ["Manufacturer", "Distributor", "Wholesaler", "Retailer", "Service Provider", "Other"], default: "Other" },
        
        // Contact Person
        contactPerson: { type: String },
        contactEmail: { type: String },
        contactPhone: { type: String },
        
        // Bank Details
        bankName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
        accountHolderName: { type: String },
        
        // Payment Terms
        paymentTerms: { type: String, default: "Net 30" },
        creditLimit: { type: Number, default: 0 },
        
        // Status
        status: { type: String, enum: ["Active", "Inactive", "Blacklisted"], default: "Active" },
        
        // Rating
        rating: { type: Number, min: 1, max: 5, default: 3 },
        
        // Notes
        notes: { type: String },
        
        // Meta
        createdBy: { type: String },
        updatedBy: { type: String }
    },
    { timestamps: true }
)

module.exports = mongoose.model("Vendor", vendorSchema)
