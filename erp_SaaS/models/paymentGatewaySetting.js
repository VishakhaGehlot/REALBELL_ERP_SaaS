const mongoose = require('mongoose');

const paymentGatewaySettingSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    keyId: {
        type: String,
        required: true,
        trim: true
    },
    keySecret: {
        type: String,
        required: true,
        trim: true
    },
    customUpiPayload: {
        type: String,
        trim: true,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    updatedBy: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('paymentGatewaySetting', paymentGatewaySettingSchema);