const mongoose = require('mongoose');

const addcontactSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phoneno: {
        type: String,
        required: true
    },
    whatsappno: {
        type: String,
        required: true

    },
    email: {
        type: String,
        required: true
    },
    note: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "Pending"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("CRM", addcontactSchema);