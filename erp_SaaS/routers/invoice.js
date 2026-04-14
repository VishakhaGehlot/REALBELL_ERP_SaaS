const router = require("express").Router()
const Invoice = require("../models/Invoice")
const Product = require("../models/product")
const { requireAuth, allowRoles } = require("../middleware/roleAuth")
const { requireModuleAccess } = require("../middleware/permissionAuth")

const INVOICE_STATUS = ["Draft", "Sent", "Paid", "Partial", "Overdue", "Cancelled"]
const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Cheque", "Other"]

router.use(requireAuth)

// List all invoices
router.get("/invoices", requireModuleAccess("accounting", "view"), async (req, res) => {
    try {
        const { status, customer, dateFrom, dateTo } = req.query
        let filter = {}
        
        if (status && status !== "All") filter.paymentStatus = status
        if (customer) filter.customerName = { $regex: customer, $options: "i" }
        if (dateFrom || dateTo) {
            filter.invoiceDate = {}
            if (dateFrom) filter.invoiceDate.$gte = new Date(dateFrom)
            if (dateTo) filter.invoiceDate.$lte = new Date(dateTo)
        }
        
        const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).lean()
        
        // Stats
        const stats = {
            total: invoices.length,
            paid: invoices.filter(i => i.paymentStatus === "Paid").length,
            pending: invoices.filter(i => ["Draft", "Sent", "Partial"].includes(i.paymentStatus)).length,
            overdue: invoices.filter(i => i.paymentStatus === "Overdue").length,
            totalAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
            paidAmount: invoices.filter(i => i.paymentStatus === "Paid").reduce((sum, i) => sum + i.totalAmount, 0),
            pendingAmount: invoices.filter(i => ["Draft", "Sent", "Partial"].includes(i.paymentStatus)).reduce((sum, i) => sum + i.balanceAmount, 0)
        }
        
        res.render("ERP/Invoices.ejs", {
            invoices,
            stats,
            filters: { status, customer, dateFrom, dateTo },
            loginname: req.session.email,
            message: req.query.message || "",
            activeTab: "list"
        })
    } catch (error) {
        console.error("Invoices list error:", error)
        res.status(500).render("error.ejs", { message: "Failed to load invoices" })
    }
})

// New invoice form
router.get("/invoices/new", requireModuleAccess("accounting", "add"), async (req, res) => {
    try {
        const products = await Product.find({ activeStatus: "Active" }).lean()
        res.render("ERP/InvoiceForm.ejs", {
            invoice: null,
            products,
            paymentMethods: PAYMENT_METHODS,
            loginname: req.session.email,
            isEdit: false
        })
    } catch (error) {
        console.error("New invoice error:", error)
        res.redirect("/invoices?message=Failed to load form")
    }
})

// Create invoice
router.post("/invoices", requireModuleAccess("accounting", "add"), async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, customerAddress, invoiceDate, dueDate, notes, termsAndConditions } = req.body
        
        // Parse items
        const items = []
        let itemIndex = 0
        while (req.body[`items[${itemIndex}][productId]`]) {
            const quantity = parseInt(req.body[`items[${itemIndex}][quantity]`]) || 1
            const unitPrice = parseFloat(req.body[`items[${itemIndex}][unitPrice]`]) || 0
            const discount = parseFloat(req.body[`items[${itemIndex}][discount]`]) || 0
            const taxPercent = parseFloat(req.body[`items[${itemIndex}][taxPercent]`]) || 0
            const itemTotal = quantity * unitPrice
            const itemDiscount = itemTotal * (discount / 100)
            const taxableAmount = itemTotal - itemDiscount
            const taxAmount = taxableAmount * (taxPercent / 100)
            
            items.push({
                productId: req.body[`items[${itemIndex}][productId]`],
                name: req.body[`items[${itemIndex}][name]`],
                description: req.body[`items[${itemIndex}][description]`] || "",
                quantity,
                unitPrice,
                discount,
                taxPercent,
                taxAmount,
                total: taxableAmount + taxAmount
            })
            itemIndex++
        }
        
        const invoice = new Invoice({
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            invoiceDate: new Date(invoiceDate),
            dueDate: dueDate ? new Date(dueDate) : null,
            items,
            notes,
            termsAndConditions,
            createdBy: req.session.email,
            paymentStatus: "Draft"
        })
        
        await invoice.save()
        res.redirect(`/invoices/${invoice._id}?message=Invoice created successfully`)
    } catch (error) {
        console.error("Create invoice error:", error)
        res.redirect("/invoices?message=Failed to create invoice")
    }
})

// View invoice
router.get("/invoices/:id", requireModuleAccess("accounting", "view"), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).lean()
        if (!invoice) return res.redirect("/invoices?message=Invoice not found")
        
        res.render("ERP/InvoiceView.ejs", {
            invoice,
            loginname: req.session.email,
            message: req.query.message || ""
        })
    } catch (error) {
        console.error("View invoice error:", error)
        res.redirect("/invoices?message=Failed to view invoice")
    }
})

// Edit invoice form
router.get("/invoices/:id/edit", requireModuleAccess("accounting", "edit"), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).lean()
        if (!invoice) return res.redirect("/invoices?message=Invoice not found")
        
        const products = await Product.find({ activeStatus: "Active" }).lean()
        
        res.render("ERP/InvoiceForm.ejs", {
            invoice,
            products,
            paymentMethods: PAYMENT_METHODS,
            loginname: req.session.email,
            isEdit: true
        })
    } catch (error) {
        console.error("Edit invoice error:", error)
        res.redirect("/invoices?message=Failed to load invoice")
    }
})

// Update invoice
router.post("/invoices/:id", requireModuleAccess("accounting", "edit"), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
        if (!invoice) return res.redirect("/invoices?message=Invoice not found")
        
        // Update fields
        invoice.customerName = req.body.customerName
        invoice.customerEmail = req.body.customerEmail
        invoice.customerPhone = req.body.customerPhone
        invoice.customerAddress = req.body.customerAddress
        invoice.invoiceDate = new Date(req.body.invoiceDate)
        invoice.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null
        invoice.notes = req.body.notes
        invoice.termsAndConditions = req.body.termsAndConditions
        invoice.updatedBy = req.session.email
        
        // Parse items
        const items = []
        let itemIndex = 0
        while (req.body[`items[${itemIndex}][productId]`]) {
            const quantity = parseInt(req.body[`items[${itemIndex}][quantity]`]) || 1
            const unitPrice = parseFloat(req.body[`items[${itemIndex}][unitPrice]`]) || 0
            const discount = parseFloat(req.body[`items[${itemIndex}][discount]`]) || 0
            const taxPercent = parseFloat(req.body[`items[${itemIndex}][taxPercent]`]) || 0
            const itemTotal = quantity * unitPrice
            const itemDiscount = itemTotal * (discount / 100)
            const taxableAmount = itemTotal - itemDiscount
            const taxAmount = taxableAmount * (taxPercent / 100)
            
            items.push({
                productId: req.body[`items[${itemIndex}][productId]`],
                name: req.body[`items[${itemIndex}][name]`],
                description: req.body[`items[${itemIndex}][description]`] || "",
                quantity,
                unitPrice,
                discount,
                taxPercent,
                taxAmount,
                total: taxableAmount + taxAmount
            })
            itemIndex++
        }
        invoice.items = items
        
        await invoice.save()
        res.redirect(`/invoices/${invoice._id}?message=Invoice updated successfully`)
    } catch (error) {
        console.error("Update invoice error:", error)
        res.redirect("/invoices?message=Failed to update invoice")
    }
})

// Update payment status
router.post("/invoices/:id/payment", requireModuleAccess("accounting", "edit"), async (req, res) => {
    try {
        const { paymentStatus, paidAmount, paymentMethod } = req.body
        const invoice = await Invoice.findById(req.params.id)
        if (!invoice) return res.redirect("/invoices?message=Invoice not found")
        
        invoice.paymentStatus = paymentStatus
        invoice.paidAmount = parseFloat(paidAmount) || 0
        invoice.paymentMethod = paymentMethod
        invoice.balanceAmount = invoice.totalAmount - invoice.paidAmount
        
        if (paymentStatus === "Paid") {
            invoice.paidAt = new Date()
        }
        
        await invoice.save()
        res.redirect(`/invoices/${invoice._id}?message=Payment updated successfully`)
    } catch (error) {
        console.error("Payment update error:", error)
        res.redirect("/invoices?message=Failed to update payment")
    }
})

// Delete invoice
router.post("/invoices/:id/delete", requireModuleAccess("accounting", "delete"), async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id)
        res.redirect("/invoices?message=Invoice deleted successfully")
    } catch (error) {
        console.error("Delete invoice error:", error)
        res.redirect("/invoices?message=Failed to delete invoice")
    }
})

// Print invoice
router.get("/invoices/:id/print", requireModuleAccess("accounting", "view"), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).lean()
        if (!invoice) return res.redirect("/invoices?message=Invoice not found")
        
        res.render("ERP/InvoicePrint.ejs", {
            invoice,
            printMode: true
        })
    } catch (error) {
        console.error("Print invoice error:", error)
        res.redirect("/invoices?message=Failed to print invoice")
    }
})

module.exports = router
