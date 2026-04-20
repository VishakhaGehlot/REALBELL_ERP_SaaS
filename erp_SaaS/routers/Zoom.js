// routes/zoomRoutes.js
const router = require('express').Router();
const ZoomMeeting = require('../models/ZoomMeeting');

// GET - Render Zoom Template page
router.get("/schedule-meeting", (req, res) => {
    res.render("Zoom/ZoomTemplate", {
        title: "Zoom Meeting Management",
        user: req.user || null
    });
});

// GET - Get all meetings (with filters)
router.get("/zoom-meetings", async (req, res) => {
    try {
        const { search, linkStatus } = req.query;
        let filter = {};

        if (search) {
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

        const meetings = await ZoomMeeting.find(filter).sort({ createdAt: -1 });

        // Calculate statistics
        const totalMeetings = meetings.length;
        const withLinkCount = meetings.filter(m => m.joinLink && m.joinLink.trim() !== "").length;
        const todayCount = meetings.filter(m => m.dateTime && m.dateTime.toLowerCase().includes('today')).length;
        const weekCount = meetings.filter(m =>
            m.dateTime && (
                m.dateTime.toLowerCase().includes('today') ||
                m.dateTime.toLowerCase().includes('tomorrow')
            )
        ).length;

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
        console.error(error);
        res.status(500).json({ success: false, message: "Error fetching meetings" });
    }
});

// POST - Add new meeting
router.post("/zoom-meetings", async (req, res) => {
    try {
        const { title, zoomId, passcode, dateTime, joinLink } = req.body;

        if (!title && !zoomId) {
            return res.status(400).json({ success: false, message: "Please enter at least Meeting Title or Zoom ID" });
        }

        const newMeeting = new ZoomMeeting({
            title: title || "Untitled Meeting",
            zoomId: zoomId || `auto-${Date.now()}`,
            passcode: passcode || "—",
            dateTime: dateTime || "Not scheduled",
            joinLink: joinLink || ""
        });

        await newMeeting.save();
        res.json({ success: true, meeting: newMeeting, message: "Meeting added successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error adding meeting" });
    }
});

// GET - Get single meeting by ID
router.get("/zoom-meetings/:id", async (req, res) => {
    try {
        const meeting = await ZoomMeeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        res.json({ success: true, meeting });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error fetching meeting" });
    }
});

// PUT - Update meeting by ID (Edit functionality)
router.put("/zoom-meetings/:id", async (req, res) => {
    try {
        const { title, zoomId, passcode, dateTime, joinLink } = req.body;

        const updatedMeeting = await ZoomMeeting.findByIdAndUpdate(
            req.params.id,
            {
                title: title || "Untitled Meeting",
                zoomId: zoomId,
                passcode: passcode || "—",
                dateTime: dateTime || "Not scheduled",
                joinLink: joinLink || "",
                updatedAt: Date.now()
            },
            { new: true, runValidators: true }
        );

        if (!updatedMeeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        res.json({ success: true, meeting: updatedMeeting, message: "Meeting updated successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating meeting" });
    }
});

// DELETE - Delete meeting by ID
router.delete("/zoom-meetings/:id", async (req, res) => {
    try {
        const meeting = await ZoomMeeting.findByIdAndDelete(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        res.json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error deleting meeting" });
    }
});

module.exports = router;