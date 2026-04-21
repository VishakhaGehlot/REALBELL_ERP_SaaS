// models/ZoomMeeting.js
const mongoose = require('mongoose');

const zoomMeetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Meeting title is required'],
        trim: true,
        default: 'Untitled Meeting'
    },
    zoomId: {
        type: String,
        required: [true, 'Zoom ID is required'],
        trim: true
    },
    passcode: {
        type: String,
        default: "—",
        trim: true
    },
    dateTime: {
        type: String,
        default: "Not scheduled",
        trim: true
    },
    joinLink: {
        type: String,
        default: "",
        trim: true
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "auth",
        default: null,
        index: true
    },
    createdByEmail: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
        index: true
    }
}, {
    timestamps: true // This automatically handles createdAt and updatedAt
});

// Remove the pre-save middleware since timestamps: true handles it
// zoomMeetingSchema.pre('save', function(next) {
//     this.updatedAt = Date.now();
//     next();
// });

// Add index for better query performance
zoomMeetingSchema.index({ createdAt: -1 });
zoomMeetingSchema.index({ createdByUserId: 1, createdAt: -1 });

module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);