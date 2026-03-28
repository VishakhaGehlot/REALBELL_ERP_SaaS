const mongoose = require('mongoose');

const sentMessageSchema = new mongoose.Schema({
    // Unique job identifier
    jobId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Channel (whatsapp / email / sms)
    channel: {
        type: String,
        enum: ['whatsapp', 'email', 'sms'],
        default: 'email',
        required: true
    },
    
    // Message content
    message: {
        type: String,
        default: ''
    },
    
    // Message type (text / image / video / pdf / document)
    messageType: {
        type: String,
        default: 'text'
    },
    
    // Media URL if any
    mediaUrl: {
        type: String,
        default: ''
    },
    
    // File name
    fileName: {
        type: String,
        default: ''
    },
    
    // File size in bytes
    fileSize: {
        type: Number,
        default: 0
    },
    
    // Email subject (for email channel)
    subject: {
        type: String,
        default: ''
    },
    
    // To/Recipient email (for email channel)
    to: {
        type: String,
        default: ''
    },
    
    // Sent time
    sentTime: {
        type: Date,
        default: Date.now
    },
    
    // Status (Completed / Failed / Pending)
    status: {
        type: String,
        enum: ['Completed', 'Failed', 'Pending'],
        default: 'Pending'
    },
    
    // Error message if failed
    error: {
        type: String,
        default: ''
    },
    
    // Device ID (for WhatsApp) or 'smtp' for email
    deviceId: {
        type: String,
        default: ''
    },
    
    // WhatsApp number or email username
    whatsappNumber: {
        type: String,
        default: ''
    },
    
    // Campaign ID if part of campaign
    campaignId: {
        type: String,
        default: null
    },
    
    // Campaign name
    campaignName: {
        type: String,
        default: ''
    },
    
    // Recipient (phone or email)
    recipient: {
        type: String,
        default: ''
    },
    
    // Direction (outgoing / incoming)
    direction: {
        type: String,
        enum: ['outgoing', 'incoming'],
        default: 'outgoing'
    },
    
    // Bill amount (for WhatsApp campaigns)
    bill: {
        type: Number,
        default: 0
    },
    
    // Who created this message
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // Created by email
    createdByEmail: {
        type: String,
        default: ''
    },
    
    // Created by role
    createdByRole: {
        type: String,
        default: ''
    },
    
    // Created at
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
sentMessageSchema.index({ channel: 1, status: 1 });
sentMessageSchema.index({ sentTime: -1 });
sentMessageSchema.index({ createdBy: 1 });
sentMessageSchema.index({ recipient: 1 });
sentMessageSchema.index({ campaignId: 1 });

module.exports = mongoose.model('SentMessage', sentMessageSchema);