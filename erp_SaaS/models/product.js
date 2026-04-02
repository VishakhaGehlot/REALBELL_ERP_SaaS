const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['In Stock', 'Out of Stock', 'Low Stock', 'Limited Stock'],
        default: 'In Stock'
    },
    activeStatus: {
        type: String,
        enum: ['Active', 'Pending', 'Inactive'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    rating: {
        type: Number,
        default: 0
    },
    numReviews: {
        type: Number,
        default: 0
    },
});

module.exports = mongoose.model("product", productSchema);