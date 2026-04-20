const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['note', 'call', 'meeting', 'email', 'task', 'stage_change', 'document', 'payment'],
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedAt: { type: Date, default: Date.now },
  duration: { type: Number }, // in minutes for calls/meetings
  outcome: { type: String }, // success, failure, pending
  attachments: [{ type: String }], // file URLs
  metadata: { type: mongoose.Schema.Types.Mixed } // flexible data
}, { _id: true });

const stageHistorySchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  movedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movedAt: { type: Date, default: Date.now },
  reason: { type: String },
  timeInStage: { type: Number } // in hours
});

const dealSchema = new mongoose.Schema({
  // Basic Info
  title: { type: String, required: true, trim: true },
  description: { type: String },
  
  // Financials
  value: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  probability: { type: Number, min: 0, max: 100, default: 0 }, // win probability %
  
  // Expected revenue calculation
  expectedRevenue: { type: Number, default: 0 },
  
  // Stage Management
  stage: { 
    type: String, 
    enum: ['Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    default: 'Discovery'
  },
  stageHistory: [stageHistorySchema],
  
  // Pipeline & Source
  pipeline: { type: String, default: 'Sales' }, // for multiple pipelines
  source: { type: String },
  
  // Relationships
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  
  // Assignment
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // collaborative team
  
  // Dates
  expectedCloseDate: { type: Date },
  actualCloseDate: { type: Date },
  lastActivityAt: { type: Date },
  
  // Products/Services (for complex deals)
  lineItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number }
  }],
  
  // Documents & Contracts
  documents: [{
    name: { type: String },
    type: { type: String }, // proposal, contract, invoice, etc.
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Activity Log
  activities: [activitySchema],
  
  // Competition tracking
  competitors: [{
    name: { type: String },
    strengths: { type: String },
    weaknesses: { type: String },
    ourAdvantage: { type: String }
  }],
  
  // Loss reason (if lost)
  lossReason: { 
    type: String,
    enum: ['Price', 'Competitor', 'No Budget', 'No Authority', 'No Need', 'Timing', 'Other']
  },
  lossNotes: { type: String },
  
  // Win details (if won)
  winAmount: { type: Number },
  winDate: { type: Date },
  
  // Automation triggers
  automationTriggers: [{
    triggerId: { type: String },
    triggeredAt: { type: Date },
    status: { type: String, enum: ['pending', 'completed', 'failed'] }
  }],
  
  // Custom fields
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Visibility
  visibility: { 
    type: String, 
    enum: ['private', 'team', 'public'], 
    default: 'team' 
  },
  
  // Timestamps
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
dealSchema.index({ title: 'text', description: 'text' });
dealSchema.index({ stage: 1, owner: 1 });
dealSchema.index({ lead: 1 });
dealSchema.index({ expectedCloseDate: 1 });
dealSchema.index({ value: -1 });
dealSchema.index({ createdAt: -1 });
dealSchema.index({ actualCloseDate: 1 });

// Virtual for days in current stage
dealSchema.virtual('daysInStage').get(function() {
  const currentStageEntry = this.stageHistory.find(h => h.to === this.stage);
  if (!currentStageEntry) return 0;
  const startDate = currentStageEntry.movedAt;
  return Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
dealSchema.pre('save', function(next) {
  // Calculate expected revenue
  this.expectedRevenue = this.value * (this.probability / 100);
  
  // Update lastActivityAt
  if (this.activities && this.activities.length > 0) {
    this.lastActivityAt = this.activities[this.activities.length - 1].performedAt;
  }
  
  // Auto-set win/loss dates
  if (this.isModified('stage')) {
    if (this.stage === 'Closed Won' && !this.winDate) {
      this.winDate = new Date();
      this.actualCloseDate = new Date();
    }
    if (this.stage === 'Closed Lost' && !this.actualCloseDate) {
      this.actualCloseDate = new Date();
    }
  }
  
  next();
});

// Methods
dealSchema.methods.moveToStage = function(newStage, userId, reason = '') {
  const oldStage = this.stage;
  
  // Calculate time spent in previous stage
  const lastEntry = this.stageHistory[this.stageHistory.length - 1];
  const timeInStage = lastEntry ? 
    (Date.now() - lastEntry.movedAt) / (1000 * 60 * 60) : 0;
  
  // Add to history
  this.stageHistory.push({
    from: oldStage,
    to: newStage,
    movedBy: userId,
    reason: reason,
    timeInStage: timeInStage
  });
  
  // Update probability based on stage
  const stageProbabilities = {
    'Discovery': 10,
    'Proposal': 30,
    'Negotiation': 60,
    'Closed Won': 100,
    'Closed Lost': 0
  };
  
  this.stage = newStage;
  this.probability = stageProbabilities[newStage] || this.probability;
  
  // Add activity log
  this.activities.push({
    type: 'stage_change',
    title: `Moved from ${oldStage} to ${newStage}`,
    description: reason,
    performedBy: userId,
    performedAt: new Date()
  });
};

dealSchema.methods.addActivity = function(type, title, description, userId, metadata = {}) {
  this.activities.push({
    type,
    title,
    description,
    performedBy: userId,
    metadata
  });
  this.lastActivityAt = new Date();
};

// Static methods for analytics
dealSchema.statics.getPipelineStats = async function(ownerId) {
  return this.aggregate([
    { $match: { owner: mongoose.Types.ObjectId(ownerId) } },
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
        avgValue: { $avg: '$value' }
      }
    }
  ]);
};

module.exports = mongoose.model('Deal', dealSchema);
