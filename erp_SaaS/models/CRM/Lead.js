const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  designation: { type: String, trim: true },
  
  // Source & Classification
  source: { 
    type: String, 
    enum: ['Website', 'Referral', 'Social Media', 'Cold Call', 'Event', 'Advertisement', 'Partner', 'Other'],
    default: 'Website'
  },
  sourceDetails: { type: String }, // UTM params, referrer, etc.
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Nurturing', 'Converted', 'Lost'],
    default: 'New'
  },
  
  // Lead Scoring (0-100)
  score: { type: Number, min: 0, max: 100, default: 0 },
  scoreHistory: [{
    score: Number,
    reason: String,
    date: { type: Date, default: Date.now }
  }],
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedDate: { type: Date },
  
  // Location/Region for routing
  country: { type: String },
  state: { type: String },
  city: { type: String },
  
  // Engagement Tracking
  lastActivity: { type: Date },
  lastContactDate: { type: Date },
  nextFollowUpDate: { type: Date },
  totalActivities: { type: Number, default: 0 },
  
  // Marketing
  tags: [{ type: String }],
  campaigns: [{ type: String }],
  
  // Custom Fields (flexible)
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1, assignedTo: 1 });
leadSchema.index({ score: -1 });
leadSchema.index({ source: 1 });
leadSchema.index({ nextFollowUpDate: 1 });
leadSchema.index({ createdAt: -1 });

// Virtual for deals
leadSchema.virtual('deals', {
  ref: 'Deal',
  localField: '_id',
  foreignField: 'lead'
});

// Pre-save middleware for scoring
leadSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.calculateScore();
  }
  next();
});

// Calculate lead score based on various factors
leadSchema.methods.calculateScore = function() {
  let score = 0;
  
  // Status-based scoring
  const statusScores = {
    'New': 10,
    'Contacted': 25,
    'Qualified': 60,
    'Unqualified': 0,
    'Nurturing': 40,
    'Converted': 100,
    'Lost': 0
  };
  
  score += statusScores[this.status] || 0;
  
  // Activity-based scoring
  score += Math.min(this.totalActivities * 5, 30);
  
  // Source quality
  const sourceScores = {
    'Referral': 15,
    'Website': 10,
    'Social Media': 5,
    'Cold Call': 0
  };
  score += sourceScores[this.source] || 0;
  
  // Cap at 100
  this.score = Math.min(score, 100);
};

module.exports = mongoose.model('Lead', leadSchema);
