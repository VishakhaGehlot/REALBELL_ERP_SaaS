const router = require('express').Router();
const upload = require('../middleware/multer');
const ProductTable = require('../models/product');

// Show table
router.get("/producttable", async (req, res) => {
    const productdata = await ProductTable.find();
    res.render("Product/ProductTable", { productdata });
});

router.get("/products", async (req, res) => {
    const productdata = await ProductTable.find({ activeStatus: "Active" });
    res.render("Home/HProduct", { productdata });
});

// Add product page
router.get("/addproduct", (req, res) => {
    res.render("Product/AddProduct");
});

// Save product
router.post("/addproduct", upload.single("img"), async (req, res) => {
    try {
        const imgName = req.file.filename;
        const { name, price, stock, status, rating, numReviews, activeStatus } = req.body;

        const ProductData = new ProductTable({
            name,
            price,
            stock,
            status: status || 'Pending',
            activeStatus: activeStatus || 'Pending',
            rating: rating || 0,
            numReviews: numReviews || 0,
            image: imgName,
            createdAt: new Date()
        });

        await ProductData.save();
        res.redirect("/producttable");
    } catch (err) {
        console.log(err);
        // res.status(500).send("Error adding product");
            res.status(500).send(err.message); 
    }
});

// Edit product page
router.get("/editproduct/:id", async (req, res) => {
    try {
        const product = await ProductTable.findById(req.params.id);
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render("Product/EditProduct", { product });
    } catch (err) {
        console.log(err);
        res.status(500).send("Error loading edit page");
    }
});

// Update product
router.post("/editproduct/:id", upload.single("img"), async (req, res) => {
    try {
        const { name, price, stock, status, rating, numReviews, activeStatus } = req.body;
        
        const updateData = {
            name,
            price,
            stock,
            status: status || 'Pending',
            activeStatus: activeStatus || 'Pending',
            rating: rating || 0,
            numReviews: numReviews || 0
        };

        if (req.file) {
            updateData.image = req.file.filename;
        }

        await ProductTable.findByIdAndUpdate(req.params.id, updateData);
        res.redirect("/producttable");
    } catch (err) {
        console.log(err);
        res.status(500).send("Error updating product");
    }
});

// Update active status only (AJAX endpoint)
router.post("/updatestatus/:id", async (req, res) => {
    try {
        const { activeStatus } = req.body;
        await ProductTable.findByIdAndUpdate(req.params.id, { activeStatus });
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete product
router.get("/deleteproduct/:id", async (req, res) => {
    try {
        await ProductTable.findByIdAndDelete(req.params.id);
        res.redirect("/producttable");
    } catch (err) {
        console.log(err);
        res.status(500).send("Error deleting product");
    }
});

module.exports = router;