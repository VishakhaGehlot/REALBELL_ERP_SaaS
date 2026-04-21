const router = require("express").Router()
const Vendor = require("../models/Vendor")
const { requireAuth } = require("../middleware/roleAuth")
const { requireModuleAccess } = require("../middleware/permissionAuth")
const { buildOwnedDocumentFilter } = require("../middleware/dataScope")

const BUSINESS_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Retailer", "Service Provider", "Other"]
const VENDOR_STATUS = ["Active", "Inactive", "Blacklisted"]
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt", "Advance", "COD"]

router.use(requireAuth)

function buildVendorScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        emailFields: ["createdBy"]
    }, baseFilter)
}

// List all vendors
router.get("/vendors", requireModuleAccess("productManagement", "view"), async (req, res) => {
    try {
        const { status, businessType, search } = req.query
        let filter = {}
        
        if (status && status !== "All") filter.status = status
        if (businessType && businessType !== "All") filter.businessType = businessType
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { gstNumber: { $regex: search, $options: "i" } }
            ]
        }
        
        const vendors = await Vendor.find(buildVendorScopeFilter(req, filter)).sort({ createdAt: -1 }).lean()
        
        const stats = {
            total: vendors.length,
            active: vendors.filter(v => v.status === "Active").length,
            inactive: vendors.filter(v => v.status === "Inactive").length,
            blacklisted: vendors.filter(v => v.status === "Blacklisted").length
        }
        
        res.render("ERP/Vendors.ejs", {
            vendors,
            stats,
            filters: { status, businessType, search },
            businessTypes: BUSINESS_TYPES,
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("Vendors list error:", error)
        res.status(500).render("error.ejs", { message: "Failed to load vendors" })
    }
})

// New vendor form
router.get("/vendors/new", requireModuleAccess("productManagement", "add"), async (req, res) => {
    try {
        res.render("ERP/VendorForm.ejs", {
            vendor: null,
            businessTypes: BUSINESS_TYPES,
            vendorStatus: VENDOR_STATUS,
            paymentTerms: PAYMENT_TERMS,
            loginname: req.session.email,
            isEdit: false
        })
    } catch (error) {
        console.error("New vendor error:", error)
        res.redirect("/vendors?message=Failed to load form")
    }
})

// Create vendor
router.post("/vendors", requireModuleAccess("productManagement", "add"), async (req, res) => {
    try {
        const currentUserEmail = String(req.session?.email || "").trim().toLowerCase()
        const vendor = new Vendor({
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address,
            city: req.body.city,
            state: req.body.state,
            pincode: req.body.pincode,
            country: req.body.country || "India",
            gstNumber: req.body.gstNumber,
            panNumber: req.body.panNumber,
            businessType: req.body.businessType,
            contactPerson: req.body.contactPerson,
            contactEmail: req.body.contactEmail,
            contactPhone: req.body.contactPhone,
            bankName: req.body.bankName,
            accountNumber: req.body.accountNumber,
            ifscCode: req.body.ifscCode,
            accountHolderName: req.body.accountHolderName,
            paymentTerms: req.body.paymentTerms,
            creditLimit: parseFloat(req.body.creditLimit) || 0,
            status: req.body.status || "Active",
            rating: parseInt(req.body.rating) || 3,
            notes: req.body.notes,
            createdBy: currentUserEmail
        })
        
        await vendor.save()
        res.redirect(`/vendors/${vendor._id}?message=Vendor created successfully`)
    } catch (error) {
        console.error("Create vendor error:", error)
        res.redirect("/vendors?message=Failed to create vendor")
    }
})

// View vendor
router.get("/vendors/:id", requireModuleAccess("productManagement", "view"), async (req, res) => {
    try {
        const vendor = await Vendor.findOne(buildVendorScopeFilter(req, { _id: req.params.id })).lean()
        if (!vendor) return res.redirect("/vendors?message=Vendor not found")
        
        // Get purchase orders for this vendor
        const PurchaseOrder = require("../models/PurchaseOrder")
        const purchaseOrders = await PurchaseOrder.find(buildOwnedDocumentFilter(req, {
            emailFields: ["createdBy"]
        }, { vendorId: vendor._id })).sort({ createdAt: -1 }).limit(5).lean()
        
        res.render("ERP/VendorView.ejs", {
            vendor,
            purchaseOrders,
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("View vendor error:", error)
        res.redirect("/vendors?message=Failed to view vendor")
    }
})

// Edit vendor form
router.get("/vendors/:id/edit", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const vendor = await Vendor.findOne(buildVendorScopeFilter(req, { _id: req.params.id })).lean()
        if (!vendor) return res.redirect("/vendors?message=Vendor not found")
        
        res.render("ERP/VendorForm.ejs", {
            vendor,
            businessTypes: BUSINESS_TYPES,
            vendorStatus: VENDOR_STATUS,
            paymentTerms: PAYMENT_TERMS,
            loginname: req.session.email,
            isEdit: true
        })
    } catch (error) {
        console.error("Edit vendor error:", error)
        res.redirect("/vendors?message=Failed to load vendor")
    }
})

// Update vendor
router.post("/vendors/:id", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const vendor = await Vendor.findOne(buildVendorScopeFilter(req, { _id: req.params.id }))
        if (!vendor) return res.redirect("/vendors?message=Vendor not found")
        
        vendor.name = req.body.name
        vendor.email = req.body.email
        vendor.phone = req.body.phone
        vendor.address = req.body.address
        vendor.city = req.body.city
        vendor.state = req.body.state
        vendor.pincode = req.body.pincode
        vendor.country = req.body.country || "India"
        vendor.gstNumber = req.body.gstNumber
        vendor.panNumber = req.body.panNumber
        vendor.businessType = req.body.businessType
        vendor.contactPerson = req.body.contactPerson
        vendor.contactEmail = req.body.contactEmail
        vendor.contactPhone = req.body.contactPhone
        vendor.bankName = req.body.bankName
        vendor.accountNumber = req.body.accountNumber
        vendor.ifscCode = req.body.ifscCode
        vendor.accountHolderName = req.body.accountHolderName
        vendor.paymentTerms = req.body.paymentTerms
        vendor.creditLimit = parseFloat(req.body.creditLimit) || 0
        vendor.status = req.body.status || "Active"
        vendor.rating = parseInt(req.body.rating) || 3
        vendor.notes = req.body.notes
        vendor.updatedBy = String(req.session?.email || "").trim().toLowerCase()
        
        await vendor.save()
        res.redirect(`/vendors/${vendor._id}?message=Vendor updated successfully`)
    } catch (error) {
        console.error("Update vendor error:", error)
        res.redirect("/vendors?message=Failed to update vendor")
    }
})

// Delete vendor
router.post("/vendors/:id/delete", requireModuleAccess("productManagement", "delete"), async (req, res) => {
    try {
        await Vendor.findOneAndDelete(buildVendorScopeFilter(req, { _id: req.params.id }))
        res.redirect("/vendors?message=Vendor deleted successfully")
    } catch (error) {
        console.error("Delete vendor error:", error)
        res.redirect("/vendors?message=Failed to delete vendor")
    }
})

module.exports = router
