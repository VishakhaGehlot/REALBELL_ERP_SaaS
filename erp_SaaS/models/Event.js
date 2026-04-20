const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        default: null
    },
    type: {
        type: String,
        enum: ['Conference', 'Webinar', 'Workshop', 'Meeting', 'Seminar', 'General'],
        default: 'General'
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled'],
        default: 'pending'
    },
    location: {
        type: String,
        trim: true,
        default: ''
    },
    capacity: {
        type: Number,
        default: 100
    },
    registered: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    organizer: {
        type: String,
        trim: true,
        default: ''
    },
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    color: {
        type: String,
        default: '#667eea'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    reminderSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries
eventSchema.index({ start: 1, status: 1 });
eventSchema.index({ createdBy: 1, start: -1 });
eventSchema.index({ status: 1 });

// Virtual for registration percentage
eventSchema.virtual('registrationPercent').get(function() {
    if (!this.capacity || this.capacity === 0) return 0;
    return Math.round((this.registered / this.capacity) * 100);
});

// Method to check if event is full
eventSchema.methods.isFull = function() {
    return this.registered >= this.capacity;
};

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
    return this.start > new Date() && this.status === 'pending';
};

// Static method to get events by date range
eventSchema.statics.getByDateRange = function(startDate, endDate, userId) {
    return this.find({
        $or: [
            { createdBy: userId },
            { attendees: userId },
            { isPublic: true }
        ],
        start: { $gte: startDate },
        end: { $lte: endDate }
    }).sort({ start: 1 });
};

// Static method to get upcoming events
eventSchema.statics.getUpcoming = function(userId, limit = 10) {
    return this.find({
        $or: [
            { createdBy: userId },
            { attendees: userId },
            { isPublic: true }
        ],
        start: { $gte: new Date() },
        status: { $nin: ['completed', 'cancelled'] }
    })
    .sort({ start: 1 })
    .limit(limit);
};

// Static method to get dashboard stats
eventSchema.statics.getStats = async function(userId) {
    const now = new Date();
    
    const [
        total,
        upcoming,
        active,
        completed,
        pending,
        cancelled
    ] = await Promise.all([
        this.countDocuments({ $or: [{ createdBy: userId }, { isPublic: true }] }),
        this.countDocuments({
            $or: [{ createdBy: userId }, { isPublic: true }],
            start: { $gte: now },
            status: { $nin: ['completed', 'cancelled'] }
        }),
        this.countDocuments({ $or: [{ createdBy: userId }, { isPublic: true }], status: 'active' }),
        this.countDocuments({ $or: [{ createdBy: userId }, { isPublic: true }], status: 'completed' }),
        this.countDocuments({ $or: [{ createdBy: userId }, { isPublic: true }], status: 'pending' }),
        this.countDocuments({ $or: [{ createdBy: userId }, { isPublic: true }], status: 'cancelled' })
    ]);
    
    return { total, upcoming, active, completed, pending, cancelled };
};

module.exports = mongoose.model('Event', eventSchema);
