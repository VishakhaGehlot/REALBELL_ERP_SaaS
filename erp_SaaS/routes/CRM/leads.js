const express = require('express');
const router = express.Router();
const Lead = require('../../models/CRM/Lead');
const Deal = require('../../models/CRM/Deal');
const Activity = require('../../models/CRM/Activity');
const { auth, checkPermission } = require('../../middleware/auth');

// Get all leads with filters, pagination, and sorting
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      source,
      assignedTo,
      score,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = { $in: status.split(',') };
    if (source) filter.source = { $in: source.split(',') };
    if (assignedTo) filter.assignedTo = assignedTo;
    if (score) filter.score = { $gte: parseInt(score) };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    // Execute query
    const leads = await Lead.find(filter)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email avatar')
      .populate('deals', 'title value stage');

    const total = await Lead.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasMore: parseInt(page) < totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single lead with all details
router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email avatar phone')
      .populate('deals', 'title value stage expectedCloseDate')
      .populate('createdBy', 'name');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Get related activities
    const activities = await Activity.find({
      'relatedTo.id': lead._id,
      'relatedTo.type': 'Lead'
    })
      .populate('performedBy', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: {
        lead,
        activities,
        stats: {
          totalActivities: activities.length,
          daysSinceCreation: Math.floor((Date.now() - lead.createdAt) / (1000 * 60 * 60 * 24)),
          conversionProbability: lead.score
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new lead
router.post('/', auth, async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Check for duplicate email
    if (leadData.email) {
      const existingLead = await Lead.findOne({ email: leadData.email });
      if (existingLead) {
        return res.status(400).json({ 
          success: false, 
          error: 'Lead with this email already exists',
          existingLead: existingLead._id
        });
      }
    }

    const lead = new Lead(leadData);
    await lead.save();

    // Create activity log
    await Activity.create({
      type: 'note',
      subject: 'Lead Created',
      description: `Lead ${lead.name} was created`,
      relatedTo: { type: 'Lead', id: lead._id },
      performedBy: req.user._id,
      isAutomated: true
    });

    // Auto-assign based on rules
    if (req.body.autoAssign) {
      await autoAssignLead(lead);
    }

    res.status(201).json({
      success: true,
      data: lead,
      message: 'Lead created successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update lead
router.put('/:id', auth, async (req, res) => {
  try {
    const updates = {
      ...req.body,
      updatedBy: req.user._id
    };

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Log status change if applicable
    if (req.body.status) {
      await Activity.create({
        type: 'note',
        subject: 'Status Updated',
        description: `Lead status changed to ${req.body.status}`,
        relatedTo: { type: 'Lead', id: lead._id },
        performedBy: req.user._id
      });
    }

    res.json({
      success: true,
      data: lead,
      message: 'Lead updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update lead status only
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedBy: req.user._id,
        lastActivity: new Date()
      },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // If status is Converted, optionally create a deal
    if (status === 'Converted' && req.body.createDeal) {
      const deal = await Deal.create({
        title: `${lead.company || lead.name} Deal`,
        value: req.body.dealValue || 0,
        stage: 'Discovery',
        lead: lead._id,
        owner: req.user._id,
        createdBy: req.user._id
      });
      
      return res.json({
        success: true,
        data: { lead, deal },
        message: 'Lead converted to deal successfully'
      });
    }

    res.json({
      success: true,
      data: lead,
      message: 'Status updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Assign lead to user
router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: userId,
        assignedBy: req.user._id,
        assignedDate: new Date(),
        updatedBy: req.user._id
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Create notification activity
    await Activity.create({
      type: 'note',
      subject: 'Lead Assigned',
      description: `Lead assigned to ${lead.assignedTo?.name || 'Unknown'}`,
      relatedTo: { type: 'Lead', id: lead._id },
      performedBy: req.user._id
    });

    res.json({
      success: true,
      data: lead,
      message: 'Lead assigned successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Bulk operations
router.post('/bulk', auth, async (req, res) => {
  try {
    const { operation, ids, data } = req.body;
    
    let result;
    switch (operation) {
      case 'assign':
        result = await Lead.updateMany(
          { _id: { $in: ids } },
          { assignedTo: data.userId, assignedDate: new Date() }
        );
        break;
      case 'status':
        result = await Lead.updateMany(
          { _id: { $in: ids } },
          { status: data.status }
        );
        break;
      case 'delete':
        result = await Lead.deleteMany({ _id: { $in: ids } });
        break;
      case 'tag':
        result = await Lead.updateMany(
          { _id: { $in: ids } },
          { $addToSet: { tags: { $each: data.tags } } }
        );
        break;
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }

    res.json({
      success: true,
      data: result,
      message: `Bulk ${operation} completed successfully`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete lead
router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Cascade delete related activities
    await Activity.deleteMany({
      'relatedTo.id': lead._id,
      'relatedTo.type': 'Lead'
    });

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get lead statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    const sourceStats = await Lead.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    const conversionRate = await Lead.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          converted: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        bySource: sourceStats,
        conversionRate: conversionRate[0] ? 
          ((conversionRate[0].converted / conversionRate[0].total) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function for auto-assignment
async function autoAssignLead(lead) {
  // Implement round-robin or load-based assignment logic
  const users = await User.find({ role: 'sales', active: true });
  if (users.length > 0) {
    // Simple round-robin - in production, use more sophisticated logic
    const assignedUser = users[Math.floor(Math.random() * users.length)];
    lead.assignedTo = assignedUser._id;
    lead.assignedDate = new Date();
    await lead.save();
  }
}

module.exports = router;
