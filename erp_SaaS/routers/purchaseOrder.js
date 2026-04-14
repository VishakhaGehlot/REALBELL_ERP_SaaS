const router = require("express").Router()
const PurchaseOrder = require("../models/PurchaseOrder")
const Vendor = require("../models/Vendor")
const Product = require("../models/product")
const { requireAuth } = require("../middleware/roleAuth")
const { requireModuleAccess } = require("../middleware/permissionAuth")

const PO_STATUS = ["Draft", "Sent", "Acknowledged", "Partially Received", "Received", "Cancelled", "Closed"]
const DELIVERY_STATUS = ["Pending", "In Transit", "Delivered", "Partial"]
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt", "Advance", "COD"]

router.use(requireAuth)

// List all purchase orders
router.get("/purchase-orders", requireModuleAccess("productManagement", "view"), async (req, res) => {
    try {
        const { status, vendor, dateFrom, dateTo } = req.query
        let filter = {}
        
        if (status && status !== "All") filter.status = status
        if (vendor) filter.vendorName = { $regex: vendor, $options: "i" }
        if (dateFrom || dateTo) {
            filter.poDate = {}
            if (dateFrom) filter.poDate.$gte = new Date(dateFrom)
            if (dateTo) filter.poDate.$lte = new Date(dateTo)
        }
        
        const purchaseOrders = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).lean()
        
        // Stats
        const stats = {
            total: purchaseOrders.length,
            draft: purchaseOrders.filter(po => po.status === "Draft").length,
            sent: purchaseOrders.filter(po => po.status === "Sent").length,
            received: purchaseOrders.filter(po => po.status === "Received").length,
            pending: purchaseOrders.filter(po => ["Draft", "Sent", "Acknowledged"].includes(po.status)).length,
            partiallyReceived: purchaseOrders.filter(po => po.status === "Partially Received").length,
            totalAmount: purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0)
        }
        
        res.render("ERP/PurchaseOrders.ejs", {
            purchaseOrders,
            stats,
            filters: { status, vendor, dateFrom, dateTo },
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("PO list error:", error)
        res.status(500).render("error.ejs", { message: "Failed to load purchase orders" })
    }
})

// New PO form
router.get("/purchase-orders/new", requireModuleAccess("productManagement", "add"), async (req, res) => {
    try {
        const [vendors, products] = await Promise.all([
            Vendor.find({ status: "Active" }).lean(),
            Product.find({ activeStatus: "Active" }).lean()
        ])
        
        res.render("ERP/PurchaseOrderForm.ejs", {
            purchaseOrder: null,
            vendors,
            products,
            paymentTerms: PAYMENT_TERMS,
            loginname: req.session.email,
            isEdit: false
        })
    } catch (error) {
        console.error("New PO error:", error)
        res.redirect("/purchase-orders?message=Failed to load form")
    }
})

// Create PO
router.post("/purchase-orders", requireModuleAccess("productManagement", "add"), async (req, res) => {
    try {
        const { vendorId, vendorName, vendorEmail, vendorPhone, vendorAddress, vendorGstNumber, poDate, expectedDeliveryDate, paymentTerms, notes, termsAndConditions } = req.body
        
        // Parse items
        const items = []
        let itemIndex = 0
        while (req.body[`items[${itemIndex}][name]`]) {
            const quantity = parseInt(req.body[`items[${itemIndex}][quantity]`]) || 1
            const unitPrice = parseFloat(req.body[`items[${itemIndex}][unitPrice]`]) || 0
            const discount = parseFloat(req.body[`items[${itemIndex}][discount]`]) || 0
            const taxPercent = parseFloat(req.body[`items[${itemIndex}][taxPercent]`]) || 0
            const itemTotal = quantity * unitPrice
            const itemDiscount = itemTotal * (discount / 100)
            const taxableAmount = itemTotal - itemDiscount
            const taxAmount = taxableAmount * (taxPercent / 100)
            
            items.push({
                productId: req.body[`items[${itemIndex}][productId]`] || null,
                name: req.body[`items[${itemIndex}][name]`],
                description: req.body[`items[${itemIndex}][description]`] || "",
                quantity,
                unitPrice,
                discount,
                taxPercent,
                taxAmount,
                total: taxableAmount + taxAmount,
                receivedQty: 0,
                pendingQty: quantity
            })
            itemIndex++
        }
        
        const po = new PurchaseOrder({
            vendorId: vendorId || null,
            vendorName,
            vendorEmail,
            vendorPhone,
            vendorAddress,
            vendorGstNumber,
            poDate: new Date(poDate),
            expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
            paymentTerms,
            items,
            notes,
            termsAndConditions,
            createdBy: req.session.email,
            status: "Draft"
        })
        
        await po.save()
        res.redirect(`/purchase-orders/${po._id}?message=Purchase Order created successfully`)
    } catch (error) {
        console.error("Create PO error:", error)
        res.redirect("/purchase-orders?message=Failed to create purchase order")
    }
})

// View PO
router.get("/purchase-orders/:id", requireModuleAccess("productManagement", "view"), async (req, res) => {
    try {
        const purchaseOrder = await PurchaseOrder.findById(req.params.id).lean()
        if (!purchaseOrder) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        res.render("ERP/PurchaseOrderView.ejs", {
            purchaseOrder,
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("View PO error:", error)
        res.redirect("/purchase-orders?message=Failed to view purchase order")
    }
})

// Edit PO form
router.get("/purchase-orders/:id/edit", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const [purchaseOrder, vendors, products] = await Promise.all([
            PurchaseOrder.findById(req.params.id).lean(),
            Vendor.find({ status: "Active" }).lean(),
            Product.find({ activeStatus: "Active" }).lean()
        ])
        
        if (!purchaseOrder) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        res.render("ERP/PurchaseOrderForm.ejs", {
            purchaseOrder,
            vendors,
            products,
            paymentTerms: PAYMENT_TERMS,
            loginname: req.session.email,
            isEdit: true
        })
    } catch (error) {
        console.error("Edit PO error:", error)
        res.redirect("/purchase-orders?message=Failed to load purchase order")
    }
})

// Update PO
router.post("/purchase-orders/:id", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id)
        if (!po) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        // Update fields
        po.vendorId = req.body.vendorId || null
        po.vendorName = req.body.vendorName
        po.vendorEmail = req.body.vendorEmail
        po.vendorPhone = req.body.vendorPhone
        po.vendorAddress = req.body.vendorAddress
        po.vendorGstNumber = req.body.vendorGstNumber
        po.poDate = new Date(req.body.poDate)
        po.expectedDeliveryDate = req.body.expectedDeliveryDate ? new Date(req.body.expectedDeliveryDate) : null
        po.paymentTerms = req.body.paymentTerms
        po.notes = req.body.notes
        po.termsAndConditions = req.body.termsAndConditions
        po.updatedBy = req.session.email
        
        // Parse items
        const items = []
        let itemIndex = 0
        while (req.body[`items[${itemIndex}][name]`]) {
            const quantity = parseInt(req.body[`items[${itemIndex}][quantity]`]) || 1
            const unitPrice = parseFloat(req.body[`items[${itemIndex}][unitPrice]`]) || 0
            const discount = parseFloat(req.body[`items[${itemIndex}][discount]`]) || 0
            const taxPercent = parseFloat(req.body[`items[${itemIndex}][taxPercent]`]) || 0
            const itemTotal = quantity * unitPrice
            const itemDiscount = itemTotal * (discount / 100)
            const taxableAmount = itemTotal - itemDiscount
            const taxAmount = taxableAmount * (taxPercent / 100)
            
            items.push({
                productId: req.body[`items[${itemIndex}][productId]`] || null,
                name: req.body[`items[${itemIndex}][name]`],
                description: req.body[`items[${itemIndex}][description]`] || "",
                quantity,
                unitPrice,
                discount,
                taxPercent,
                taxAmount,
                total: taxableAmount + taxAmount,
                receivedQty: 0,
                pendingQty: quantity
            })
            itemIndex++
        }
        po.items = items
        
        await po.save()
        res.redirect(`/purchase-orders/${po._id}?message=Purchase Order updated successfully`)
    } catch (error) {
        console.error("Update PO error:", error)
        res.redirect("/purchase-orders?message=Failed to update purchase order")
    }
})

// Update PO status
router.post("/purchase-orders/:id/status", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const { status, deliveryStatus } = req.body
        const po = await PurchaseOrder.findById(req.params.id)
        if (!po) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        if (status) po.status = status
        if (deliveryStatus) po.deliveryStatus = deliveryStatus
        
        if (status === "Sent" && !po.sentAt) {
            po.sentAt = new Date()
        }
        if (status === "Received" && !po.receivedAt) {
            po.receivedAt = new Date()
            po.actualDeliveryDate = new Date()
        }
        
        await po.save()
        res.redirect(`/purchase-orders/${po._id}?message=Status updated successfully`)
    } catch (error) {
        console.error("Status update error:", error)
        res.redirect("/purchase-orders?message=Failed to update status")
    }
})

// Receive items (GRN - Goods Receipt Note)
router.post("/purchase-orders/:id/receive", requireModuleAccess("productManagement", "edit"), async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id)
        if (!po) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        // Update received quantities
        po.items.forEach((item, index) => {
            const receivedQty = parseInt(req.body[`received[${index}]`]) || 0
            if (receivedQty > 0) {
                item.receivedQty = (item.receivedQty || 0) + receivedQty
                item.pendingQty = Math.max(0, item.quantity - item.receivedQty)
            }
        })
        
        // Update status based on received quantities
        const totalPending = po.items.reduce((sum, item) => sum + (item.pendingQty || 0), 0)
        const totalQty = po.items.reduce((sum, item) => sum + item.quantity, 0)
        
        if (totalPending === 0) {
            po.status = "Received"
            po.deliveryStatus = "Delivered"
            po.receivedAt = new Date()
            po.actualDeliveryDate = new Date()
        } else if (totalPending < totalQty) {
            po.status = "Partially Received"
            po.deliveryStatus = "Partial"
        }
        
        await po.save()
        res.redirect(`/purchase-orders/${po._id}?message=Items received successfully`)
    } catch (error) {
        console.error("Receive items error:", error)
        res.redirect("/purchase-orders?message=Failed to receive items")
    }
})

// Delete PO
router.post("/purchase-orders/:id/delete", requireModuleAccess("productManagement", "delete"), async (req, res) => {
    try {
        await PurchaseOrder.findByIdAndDelete(req.params.id)
        res.redirect("/purchase-orders?message=Purchase Order deleted successfully")
    } catch (error) {
        console.error("Delete PO error:", error)
        res.redirect("/purchase-orders?message=Failed to delete purchase order")
    }
})

// Print PO
router.get("/purchase-orders/:id/print", requireModuleAccess("productManagement", "view"), async (req, res) => {
    try {
        const purchaseOrder = await PurchaseOrder.findById(req.params.id).lean()
        if (!purchaseOrder) return res.redirect("/purchase-orders?message=Purchase Order not found")
        
        res.render("ERP/PurchaseOrderPrint.ejs", {
            purchaseOrder,
            printMode: true
        })
    } catch (error) {
        console.error("Print PO error:", error)
        res.redirect("/purchase-orders?message=Failed to print purchase order")
    }
})

module.exports = router
