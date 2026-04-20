const express = require('express');
const router = express.Router();
const Deal = require('../../models/CRM/Deal');
const Lead = require('../../models/CRM/Lead');
const Activity = require('../../models/CRM/Activity');
const { auth } = require('../../middleware/auth');

// Get all deals with filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      stage,
      pipeline,
      owner,
      lead,
      minValue,
      maxValue,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
      expectedCloseStart,
      expectedCloseEnd
    } = req.query;

    const filter = {};
    
    if (stage) filter.stage = { $in: stage.split(',') };
    if (pipeline) filter.pipeline = pipeline;
    if (owner) filter.owner = owner;
    if (lead) filter.lead = lead;
    
    if (minValue || maxValue) {
      filter.value = {};
      if (minValue) filter.value.$gte = parseFloat(minValue);
      if (maxValue) filter.value.$lte = parseFloat(maxValue);
    }
    
    if (expectedCloseStart || expectedCloseEnd) {
      filter.expectedCloseDate = {};
      if (expectedCloseStart) filter.expectedCloseDate.$gte = new Date(expectedCloseStart);
      if (expectedCloseEnd) filter.expectedCloseDate.$lte = new Date(expectedCloseEnd);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const deals = await Deal.find(filter)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('lead', 'name email company phone')
      .populate('owner', 'name email avatar')
      .populate('organization', 'name');

    const total = await Deal.countDocuments(filter);

    res.json({
      success: true,
      data: deals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pipeline view data (grouped by stage)
router.get('/pipeline/view', auth, async (req, res) => {
  try {
    const { pipeline = 'Sales', owner } = req.query;
    
    const filter = { pipeline };
    if (owner) filter.owner = owner;

    // Get deals grouped by stage
    const pipelineData = await Deal.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$stage',
          deals: {
            $push: {
              _id: '$_id',
              title: '$title',
              value: '$value',
              expectedRevenue: '$expectedRevenue',
              probability: '$probability',
              expectedCloseDate: '$expectedCloseDate',
              lead: '$lead',
              owner: '$owner',
              lastActivityAt: '$lastActivityAt'
            }
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$value' },
          totalExpectedRevenue: { $sum: '$expectedRevenue' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Define stage order and info
    const stageOrder = ['Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
    const stageInfo = {
      'Discovery': { color: '#3b82f6', icon: 'search', order: 1 },
      'Proposal': { color: '#8b5cf6', icon: 'file-text', order: 2 },
      'Negotiation': { color: '#f59e0b', icon: 'handshake', order: 3 },
      'Closed Won': { color: '#10b981', icon: 'trophy', order: 4 },
      'Closed Lost': { color: '#ef4444', icon: 'x-circle', order: 5 }
    };

    // Format response
    const formattedStages = stageOrder.map(stageName => {
      const stageData = pipelineData.find(p => p._id === stageName) || {
        deals: [],
        count: 0,
        totalValue: 0,
        totalExpectedRevenue: 0
      };

      return {
        name: stageName,
        ...stageInfo[stageName],
        deals: stageData.deals,
        stats: {
          count: stageData.count,
          totalValue: stageData.totalValue,
          expectedRevenue: stageData.totalExpectedRevenue
        }
      };
    });

    // Calculate overall pipeline stats
    const totalDeals = pipelineData.reduce((sum, p) => sum + p.count, 0);
    const totalValue = pipelineData.reduce((sum, p) => sum + p.totalValue, 0);
    const weightedForecast = pipelineData.reduce((sum, p) => sum + p.totalExpectedRevenue, 0);

    res.json({
      success: true,
      data: {
        stages: formattedStages,
        summary: {
          totalDeals,
          totalValue,
          weightedForecast,
          conversionRate: calculateConversionRate(pipelineData)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single deal with full details
router.get('/:id', auth, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('lead', 'name email phone company status')
      .populate('contact', 'name email phone')
      .populate('organization', 'name industry website')
      .populate('owner', 'name email avatar phone')
      .populate('team', 'name email avatar')
      .populate('lineItems.product', 'name sku');

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Get activities
    const activities = await Activity.find({
      'relatedTo.id': deal._id,
      'relatedTo.type': 'Deal'
    })
      .populate('performedBy', 'name avatar')
      .sort({ performedAt: -1 })
      .limit(100);

    // Calculate time in each stage
    const stageMetrics = calculateStageMetrics(deal.stageHistory);

    res.json({
      success: true,
      data: {
        deal,
        activities,
        metrics: {
          daysInStage: deal.daysInStage,
          stageMetrics,
          totalActivities: activities.length,
          lastActivityDays: deal.lastActivityAt ? 
            Math.floor((Date.now() - deal.lastActivityAt) / (1000 * 60 * 60 * 24)) : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new deal
router.post('/', auth, async (req, res) => {
  try {
    const dealData = {
      ...req.body,
      createdBy: req.user._id,
      owner: req.body.owner || req.user._id
    };

    // If creating from lead, validate lead exists
    if (dealData.lead) {
      const lead = await Lead.findById(dealData.lead);
      if (!lead) {
        return res.status(400).json({ success: false, error: 'Lead not found' });
      }
      
      // Auto-populate from lead
      if (!dealData.source && lead.source) {
        dealData.source = lead.source;
      }
    }

    const deal = new Deal(dealData);
    
    // Add initial stage to history
    deal.stageHistory.push({
      from: 'None',
      to: deal.stage,
      movedBy: req.user._id,
      reason: 'Deal created'
    });

    await deal.save();

    // Create activity
    await Activity.create({
      type: 'note',
      subject: 'Deal Created',
      description: `Deal "${deal.title}" created with value ${deal.value}`,
      relatedTo: { type: 'Deal', id: deal._id },
      performedBy: req.user._id,
      isAutomated: true
    });

    // Update lead status if deal created from lead
    if (deal.lead) {
      await Lead.findByIdAndUpdate(deal.lead, { 
        status: 'Nurturing',
        lastActivity: new Date()
      });
    }

    res.status(201).json({
      success: true,
      data: await Deal.findById(deal._id)
        .populate('lead', 'name email')
        .populate('owner', 'name email'),
      message: 'Deal created successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update deal
router.put('/:id', auth, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const oldStage = deal.stage;
    const updates = { ...req.body, updatedBy: req.user._id };

    // Handle stage change
    if (req.body.stage && req.body.stage !== oldStage) {
      deal.moveToStage(req.body.stage, req.user._id, req.body.stageChangeReason || '');
      updates.stageHistory = deal.stageHistory;
      updates.probability = deal.probability;
    }

    Object.assign(deal, updates);
    await deal.save();

    res.json({
      success: true,
      data: await Deal.findById(deal._id)
        .populate('lead', 'name email')
        .populate('owner', 'name email'),
      message: 'Deal updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Move deal to different stage (drag-drop)
router.put('/:id/move', auth, async (req, res) => {
  try {
    const { stage, reason } = req.body;
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const oldStage = deal.stage;
    
    if (stage === oldStage) {
      return res.json({ success: true, data: deal, message: 'No change in stage' });
    }

    deal.moveToStage(stage, req.user._id, reason);
    deal.updatedBy = req.user._id;
    await deal.save();

    // Trigger automations if configured
    await triggerStageAutomation(deal, oldStage, stage, req.user._id);

    res.json({
      success: true,
      data: deal,
      message: `Deal moved from ${oldStage} to ${stage}`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add activity to deal
router.post('/:id/activities', auth, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    deal.addActivity(
      req.body.type,
      req.body.title,
      req.body.description,
      req.user._id,
      req.body.metadata
    );

    await deal.save();

    // Also create in Activity collection for global tracking
    const activity = await Activity.create({
      ...req.body,
      relatedTo: { type: 'Deal', id: deal._id },
      performedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: { deal, activity },
      message: 'Activity added successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update deal value/probability
router.put('/:id/value', auth, async (req, res) => {
  try {
    const { value, probability } = req.body;
    const deal = await Deal.findByIdAndUpdate(
      req.params.id,
      { 
        value,
        probability,
        expectedRevenue: value * (probability / 100),
        updatedBy: req.user._id
      },
      { new: true }
    );

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Close deal (Win/Loss)
router.put('/:id/close', auth, async (req, res) => {
  try {
    const { outcome, lossReason, lossNotes, winAmount } = req.body;
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    if (outcome === 'won') {
      deal.stage = 'Closed Won';
      deal.winAmount = winAmount || deal.value;
      deal.winDate = new Date();
      deal.actualCloseDate = new Date();
      deal.probability = 100;
    } else {
      deal.stage = 'Closed Lost';
      deal.lossReason = lossReason;
      deal.lossNotes = lossNotes;
      deal.actualCloseDate = new Date();
      deal.probability = 0;
    }

    deal.moveToStage(deal.stage, req.user._id, `Deal closed as ${outcome}`);
    deal.updatedBy = req.user._id;
    await deal.save();

    res.json({
      success: true,
      data: deal,
      message: `Deal marked as ${outcome === 'won' ? 'Won' : 'Lost'}`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete deal
router.delete('/:id', auth, async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Delete related activities
    await Activity.deleteMany({
      'relatedTo.id': deal._id,
      'relatedTo.type': 'Deal'
    });

    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get deal analytics
router.get('/stats/analytics', auth, async (req, res) => {
  try {
    const { period = 'month', owner } = req.query;
    
    const filter = {};
    if (owner) filter.owner = owner;

    // Deals by stage
    const byStage = await Deal.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalValue: { $sum: '$value' },
          avgValue: { $avg: '$value' }
        }
      }
    ]);

    // Conversion funnel
    const funnel = await Deal.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          discovery: { $sum: { $cond: [{ $eq: ['$stage', 'Discovery'] }, 1, 0] } },
          proposal: { $sum: { $cond: [{ $eq: ['$stage', 'Proposal'] }, 1, 0] } },
          negotiation: { $sum: { $cond: [{ $eq: ['$stage', 'Negotiation'] }, 1, 0] } },
          won: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] } }
        }
      }
    ]);

    // Revenue by month (for chart)
    const revenueByMonth = await Deal.aggregate([
      { 
        $match: { 
          ...filter,
          stage: 'Closed Won',
          winDate: { $exists: true }
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$winDate' },
            month: { $month: '$winDate' }
          },
          revenue: { $sum: '$winAmount' },
          deals: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    // Average time in each stage
    const stageTimes = await Deal.aggregate([
      { $match: { stageHistory: { $exists: true, $ne: [] } } },
      { $unwind: '$stageHistory' },
      {
        $group: {
          _id: '$stageHistory.from',
          avgTime: { $avg: '$stageHistory.timeInStage' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byStage,
        funnel: funnel[0] || {},
        revenueByMonth,
        stageTimes,
        forecast: calculateForecast(filter)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions
function calculateConversionRate(pipelineData) {
  const won = pipelineData.find(p => p._id === 'Closed Won')?.count || 0;
  const total = pipelineData.reduce((sum, p) => 
    p._id !== 'Closed Lost' ? sum + p.count : sum, 0
  );
  return total > 0 ? ((won / total) * 100).toFixed(2) : 0;
}

function calculateStageMetrics(history) {
  const metrics = {};
  history.forEach(entry => {
    if (!metrics[entry.from]) {
      metrics[entry.from] = { count: 0, avgTime: 0, totalTime: 0 };
    }
    metrics[entry.from].count++;
    metrics[entry.from].totalTime += entry.timeInStage || 0;
  });
  
  Object.keys(metrics).forEach(stage => {
    metrics[stage].avgTime = metrics[stage].count > 0 ? 
      (metrics[stage].totalTime / metrics[stage].count).toFixed(2) : 0;
  });
  
  return metrics;
}

async function triggerStageAutomation(deal, oldStage, newStage, userId) {
  // Placeholder for automation triggers
  // e.g., send email when moving to Proposal
  // e.g., notify manager when deal is won
  console.log(`Deal ${deal._id} moved from ${oldStage} to ${newStage}`);
}

async function calculateForecast(filter) {
  const deals = await Deal.find({ ...filter, stage: { $nin: ['Closed Won', 'Closed Lost'] } });
  return deals.reduce((sum, d) => sum + d.expectedRevenue, 0);
}

module.exports = router;
