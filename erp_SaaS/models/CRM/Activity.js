const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Activity Type
  type: { 
    type: String, 
    enum: ['call', 'email', 'meeting', 'task', 'note', 'document', 'proposal', 'quote', 'site_visit', 'demo', 'follow_up'],
    required: true 
  },
  
  // Subject/Title
  subject: { type: String, required: true },
  description: { type: String },
  
  // Related Entities (polymorphic reference)
  relatedTo: {
    type: { type: String, enum: ['Lead', 'Deal', 'Contact', 'Organization'] },
    id: { type: mongoose.Schema.Types.ObjectId }
  },
  
  // Participants
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    name: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'tentative'], default: 'pending' }
  }],
  
  // Scheduling
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number }, // in minutes
  timezone: { type: String, default: 'UTC' },
  
  // Reminders
  reminders: [{
    type: { type: String, enum: ['email', 'popup', 'sms'] },
    minutes: { type: Number }, // minutes before startTime
    sent: { type: Boolean, default: false }
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  
  // Priority
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Outcome/Result
  outcome: { type: String }, // e.g., "successful", "unsuccessful", "rescheduled"
  outcomeNotes: { type: String },
  
  // For calls
  callDetails: {
    callType: { type: String, enum: ['inbound', 'outbound'] },
    phoneNumber: { type: String },
    recordingUrl: { type: String },
    disposition: { type: String } // e.g., "interested", "not_interested", "callback_requested"
  },
  
  // For emails
  emailDetails: {
    to: [{ type: String }],
    cc: [{ type: String }],
    bcc: [{ type: String }],
    threadId: { type: String },
    messageId: { type: String },
    opened: { type: Boolean, default: false },
    clicked: { type: Boolean, default: false },
    openCount: { type: Number, default: 0 }
  },
  
  // For meetings
  meetingDetails: {
    location: { type: String },
    meetingLink: { type: String }, // for virtual meetings
    conferenceDetails: { type: String }
  },
  
  // For tasks
  taskDetails: {
    dueDate: { type: Date },
    completedAt: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Attachments
  attachments: [{
    name: { type: String },
    type: { type: String },
    url: { type: String },
    size: { type: Number }
  }],
  
  // Linked records
  linkedActivities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }],
  
  // Automation
  isAutomated: { type: Boolean, default: false },
  automationRule: { type: String }, // ID of automation rule that created this
  
  // Custom fields
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { 
  timestamps: true 
});

// Indexes
activitySchema.index({ 'relatedTo.id': 1, 'relatedTo.type': 1 });
activitySchema.index({ performedBy: 1, startTime: 1 });
activitySchema.index({ status: 1, startTime: 1 });
activitySchema.index({ type: 1 });

// Methods
activitySchema.methods.markComplete = function(notes = '') {
  this.status = 'completed';
  this.outcomeNotes = notes;
  if (this.taskDetails) {
    this.taskDetails.completedAt = new Date();
  }
};

activitySchema.methods.markNoShow = function() {
  this.status = 'no_show';
  this.outcome = 'Attendee did not show up';
};

// Static methods
activitySchema.statics.getUpcoming = function(userId, hours = 24) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() + hours);
  
  return this.find({
    'attendees.user': userId,
    startTime: { $gte: new Date(), $lte: cutoff },
    status: { $in: ['pending', 'in_progress'] }
  }).sort({ startTime: 1 });
};

activitySchema.statics.getOverdueTasks = function(userId) {
  return this.find({
    'taskDetails.assignedTo': userId,
    'taskDetails.dueDate': { $lt: new Date() },
    status: { $ne: 'completed' },
    type: 'task'
  }).sort({ 'taskDetails.dueDate': 1 });
};

module.exports = mongoose.model('Activity', activitySchema);
