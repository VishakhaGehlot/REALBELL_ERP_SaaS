// models/ZoomMeeting.js
const mongoose = require('mongoose');

const zoomMeetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    zoomId: {
        type: String,
        required: true,
        trim: true
    },
    passcode: {
        type: String,
        default: "—"
    },
    dateTime: {
        type: String,
        default: "Not scheduled"
    },
    joinLink: {
        type: String,
        default: ""
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
    }
});

zoomMeetingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);