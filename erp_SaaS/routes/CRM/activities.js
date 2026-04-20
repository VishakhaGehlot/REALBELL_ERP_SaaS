const express = require('express');
const router = express.Router();
const Activity = require('../../models/CRM/Activity');
const Deal = require('../../models/CRM/Deal');
const Lead = require('../../models/CRM/Lead');
const { auth } = require('../../middleware/auth');

// Get all activities with filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      type,
      relatedTo,
      relatedType,
      performedBy,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    
    if (type) filter.type = { $in: type.split(',') };
    if (performedBy) filter.performedBy = performedBy;
    if (status) filter.status = status;
    
    if (relatedTo && relatedType) {
      filter['relatedTo.id'] = relatedTo;
      filter['relatedTo.type'] = relatedType;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const activities = await Activity.find(filter)
      .populate('performedBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .populate('taskDetails.assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Activity.countDocuments(filter);

    res.json({
      success: true,
      data: activities,
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

// Get upcoming activities for user
router.get('/upcoming', auth, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const activities = await Activity.getUpcoming(req.user._id, parseInt(hours));
    
    res.json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get overdue tasks
router.get('/tasks/overdue', auth, async (req, res) => {
  try {
    const tasks = await Activity.getOverdueTasks(req.user._id);
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single activity
router.get('/:id', auth, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('performedBy', 'name email avatar')
      .populate('attendees.user', 'name email avatar')
      .populate('taskDetails.assignedTo', 'name email');

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create activity
router.post('/', auth, async (req, res) => {
  try {
    const activityData = {
      ...req.body,
      performedBy: req.user._id
    };

    const activity = await Activity.create(activityData);

    // Update related entity's lastActivity
    if (activity.relatedTo) {
      const { type, id } = activity.relatedTo;
      if (type === 'Lead') {
        await Lead.findByIdAndUpdate(id, { 
          lastActivity: new Date(),
          $inc: { totalActivities: 1 }
        });
      } else if (type === 'Deal') {
        await Deal.findByIdAndUpdate(id, { 
          lastActivityAt: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      data: activity,
      message: 'Activity created successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update activity
router.put('/:id', auth, async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    res.json({
      success: true,
      data: activity,
      message: 'Activity updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Complete activity (for tasks)
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    activity.markComplete(req.body.notes);
    await activity.save();

    res.json({
      success: true,
      data: activity,
      message: 'Activity marked as completed'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete activity
router.delete('/:id', auth, async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
