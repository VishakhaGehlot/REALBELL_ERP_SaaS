// routes/zoomRoutes.js
const router = require('express').Router();
const ZoomMeeting = require('../models/ZoomMeeting');
const { requireAuth } = require('../middleware/roleAuth');
const { requireModuleAccess } = require('../middleware/permissionAuth');
const { buildOwnedDocumentFilter } = require('../middleware/dataScope');

// GET - Render Zoom Template page
router.get("/schedule-meeting", requireAuth, requireModuleAccess('zoomMeeting', 'view'), (req, res) => {
    res.render("Zoom/ZoomTemplate", {
        title: "Zoom Meeting Management",
        user: req.user || null
    });
});

// GET - Get all meetings (with filters)
router.get("/zoom-meetings", requireAuth, requireModuleAccess('zoomMeeting', 'view'), async (req, res) => {
    try {
        const { search, linkStatus } = req.query;
        let filter = {};

        if (search && search.trim()) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { zoomId: { $regex: search, $options: 'i' } }
            ];
        }

        if (linkStatus === 'has_link') {
            filter.joinLink = { $ne: null, $ne: "" };
        } else if (linkStatus === 'no_link') {
            filter.$or = [
                { joinLink: null },
                { joinLink: "" }
            ];
        }

        // Apply ownership filter if function exists
        let ownershipFilter = filter;
        if (typeof buildOwnedDocumentFilter === 'function') {
            ownershipFilter = buildOwnedDocumentFilter(req, {
                idFields: ['createdByUserId'],
                emailFields: ['createdByEmail']
            }, filter);
        }

        const meetings = await ZoomMeeting.find(ownershipFilter).sort({ createdAt: -1 }).lean();

        // Calculate statistics
        const totalMeetings = meetings.length;
        const withLinkCount = meetings.filter(m => m.joinLink && m.joinLink.trim() !== "").length;
        
        // Fix date filtering - check actual date strings properly
        const todayCount = meetings.filter(m => {
            if (!m.dateTime) return false;
            const dateTimeStr = String(m.dateTime).toLowerCase();
            return dateTimeStr.includes('today') || 
                   dateTimeStr.includes(new Date().toLocaleDateString());
        }).length;
        
        const weekCount = meetings.filter(m => {
            if (!m.dateTime) return false;
            const dateTimeStr = String(m.dateTime).toLowerCase();
            return dateTimeStr.includes('today') || 
                   dateTimeStr.includes('tomorrow') ||
                   dateTimeStr.includes('week');
        }).length;

        res.json({
            success: true,
            meetings,
            stats: {
                total: totalMeetings,
                withLink: withLinkCount,
                today: todayCount,
                week: weekCount
            }
        });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ success: false, message: "Error fetching meetings: " + error.message });
    }
});

// POST - Add new meeting
router.post("/zoom-meetings", requireAuth, requireModuleAccess('zoomMeeting', 'add'), async (req, res) => {
    try {
        console.log('[Zoom Debug] Request body:', req.body);
        console.log('[Zoom Debug] Session:', req.session);
        
        const { title, zoomId, passcode, dateTime, joinLink } = req.body;
        
        // Get user info from session - handle different possible structures
        const currentUserEmail = req.session?.email || req.user?.email || req.session?.user?.email || 'unknown@example.com';
        const userId = req.session?.userId || req.user?._id || req.session?.user?.id || null;

        console.log(`[Zoom Debug] Creating meeting - User: ${currentUserEmail}, UserId: ${userId}`);

        // Validation - at least one required
        if ((!title || title.trim() === '') && (!zoomId || zoomId.trim() === '')) {
            return res.status(400).json({ 
                success: false, 
                message: "Please enter at least Meeting Title or Zoom ID" 
            });
        }

        // Create meeting object
        const meetingData = {
            title: title && title.trim() ? title.trim() : "Untitled Meeting",
            zoomId: zoomId && zoomId.trim() ? zoomId.trim() : `auto-${Date.now()}`,
            passcode: passcode && passcode.trim() ? passcode.trim() : "—",
            dateTime: dateTime && dateTime.trim() ? dateTime.trim() : "Not scheduled",
            joinLink: joinLink && joinLink.trim() ? joinLink.trim() : "",
            createdByUserId: userId,
            createdByEmail: String(currentUserEmail).toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('[Zoom Debug] Meeting data to save:', meetingData);

        const newMeeting = new ZoomMeeting(meetingData);
        
        // Validate before saving
        const validationError = newMeeting.validateSync();
        if (validationError) {
            console.error('[Zoom Debug] Validation error:', validationError);
            return res.status(400).json({ 
                success: false, 
                message: "Validation error: " + Object.values(validationError.errors).map(e => e.message).join(', ')
            });
        }

        await newMeeting.save();
        console.log(`[Zoom Debug] Meeting saved successfully: ${newMeeting._id}`);
        
        res.json({ 
            success: true, 
            meeting: newMeeting.toObject(), 
            message: "Meeting added successfully!" 
        });
    } catch (error) {
        console.error('[Zoom Debug] Error adding meeting:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error adding meeting: " + error.message 
        });
    }
});

// GET - Get single meeting by ID
router.get("/zoom-meetings/:id", requireAuth, requireModuleAccess('zoomMeeting', 'view'), async (req, res) => {
    try {
        let filter = { _id: req.params.id };
        if (typeof buildOwnedDocumentFilter === 'function') {
            filter = buildOwnedDocumentFilter(req, {
                idFields: ['createdByUserId'],
                emailFields: ['createdByEmail']
            }, filter);
        }
        
        const meeting = await ZoomMeeting.findOne(filter).lean();
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        res.json({ success: true, meeting });
    } catch (error) {
        console.error('Error fetching meeting:', error);
        res.status(500).json({ success: false, message: "Error fetching meeting: " + error.message });
    }
});

// PUT - Update meeting by ID
router.put("/zoom-meetings/:id", requireAuth, requireModuleAccess('zoomMeeting', 'edit'), async (req, res) => {
    try {
        const { title, zoomId, passcode, dateTime, joinLink } = req.body;

        let filter = { _id: req.params.id };
        if (typeof buildOwnedDocumentFilter === 'function') {
            filter = buildOwnedDocumentFilter(req, {
                idFields: ['createdByUserId'],
                emailFields: ['createdByEmail']
            }, filter);
        }

        const updateData = {
            title: title && title.trim() ? title.trim() : "Untitled Meeting",
            zoomId: zoomId && zoomId.trim() ? zoomId.trim() : "",
            passcode: passcode && passcode.trim() ? passcode.trim() : "—",
            dateTime: dateTime && dateTime.trim() ? dateTime.trim() : "Not scheduled",
            joinLink: joinLink && joinLink.trim() ? joinLink.trim() : "",
            updatedAt: new Date()
        };

        const updatedMeeting = await ZoomMeeting.findOneAndUpdate(
            filter,
            updateData,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedMeeting) {
            return res.status(404).json({ success: false, message: "Meeting not found or you don't have permission" });
        }

        res.json({ success: true, meeting: updatedMeeting, message: "Meeting updated successfully!" });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ success: false, message: "Error updating meeting: " + error.message });
    }
});

// DELETE - Delete meeting by ID
router.delete("/zoom-meetings/:id", requireAuth, requireModuleAccess('zoomMeeting', 'delete'), async (req, res) => {
    try {
        let filter = { _id: req.params.id };
        if (typeof buildOwnedDocumentFilter === 'function') {
            filter = buildOwnedDocumentFilter(req, {
                idFields: ['createdByUserId'],
                emailFields: ['createdByEmail']
            }, filter);
        }
        
        const meeting = await ZoomMeeting.findOneAndDelete(filter);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found or you don't have permission" });
        }
        res.json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ success: false, message: "Error deleting meeting: " + error.message });
    }
});

module.exports = router;