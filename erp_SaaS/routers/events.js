const router = require('express').Router();
const Event = require('../models/Event');
const { requireAuth } = require('../middleware/roleAuth');

// Helper function to get user ID from session
const getUserId = (req) => {
    return req.user?._id || req.session?.userId || req.session?.passport?.user;
};

// ==============
// FRONTEND VIEWS
// ==============

// Calendar View - Main Events Page
router.get('/calendar', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        // Fetch events from database
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        }).sort({ start: 1 }).lean();
        
        // Format events for FullCalendar
        const formattedEvents = events.map(event => ({
            id: event._id.toString(),
            title: event.title,
            start: event.start,
            end: event.end,
            type: event.type,
            status: event.status,
            location: event.location || 'TBD',
            description: event.description || '',
            capacity: event.capacity || 100,
            registered: event.registered || 0,
            color: getStatusColor(event.status)
        }));
        
        res.render('EventsManagement/calendar-view', {
            title: 'Events Calendar',
            user: req.user || req.session,
            events: formattedEvents
        });
    } catch (error) {
        console.error('Error loading calendar view:', error);
        res.status(500).send('Error loading calendar view');
    }
});

// Events List View
router.get('/events-list', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        // Fetch all events from database
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        }).sort({ start: -1 }).lean();
        
        // Format events for the template
        const formattedEvents = events.map(event => ({
            id: event._id.toString(),
            title: event.title,
            start: event.start,
            end: event.end,
            type: event.type,
            status: event.status,
            location: event.location || 'TBD',
            description: event.description || '',
            capacity: event.capacity || 100,
            registered: event.registered || 0
        }));
        
        res.render('EventsManagement/events-list', {
            title: 'Events List',
            user: req.user || req.session,
            events: formattedEvents
        });
    } catch (error) {
        console.error('Error loading events list:', error);
        res.status(500).send('Error loading events list');
    }
});

// Registrations View
router.get('/registrations', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        // Fetch all events from database for the dropdown
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        }).sort({ start: -1 }).lean();
        
        // Format events for the template
        const formattedEvents = events.map(event => ({
            id: event._id.toString(),
            title: event.title,
            start: event.start,
            capacity: event.capacity || 100,
            registered: event.registered || 0
        }));
        
        res.render('EventsManagement/registrations', {
            title: 'Event Registrations',
            user: req.user || req.session,
            events: formattedEvents
        });
    } catch (error) {
        console.error('Error loading registrations:', error);
        res.status(500).send('Error loading registrations');
    }
});

// Upcoming Events View
router.get('/upcoming-events', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        // Fetch upcoming events from database
        const now = new Date();
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ],
            start: { $gte: now },
            status: { $nin: ['completed', 'cancelled'] }
        }).sort({ start: 1 }).lean();
        
        // Format events for the template
        const formattedEvents = events.map(event => ({
            id: event._id.toString(),
            title: event.title,
            start: event.start,
            type: event.type,
            status: event.status,
            location: event.location || 'TBD',
            description: event.description || '',
            capacity: event.capacity || 100,
            registered: event.registered || 0
        }));
        
        res.render('EventsManagement/upcoming-events', {
            title: 'Upcoming Events',
            user: req.user || req.session,
            events: formattedEvents
        });
    } catch (error) {
        console.error('Error loading upcoming events:', error);
        res.status(500).send('Error loading upcoming events');
    }
});

// ==============
// API ENDPOINTS
// ==============

// Get all events (with optional filters)
router.get('/api/events', requireAuth, async (req, res) => {
    try {
        const { start, end, status, type } = req.query;
        const userId = getUserId(req);
        
        let query = {
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        };
        
        // Date range filter
        if (start && end) {
            query.start = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }
        
        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }
        
        // Type filter
        if (type && type !== 'all') {
            query.type = type;
        }
        
        const events = await Event.find(query)
            .populate('createdBy', 'firstName lastName email')
            .sort({ start: 1 });
        
        // Format events for FullCalendar
        const formattedEvents = events.map(event => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            backgroundColor: getStatusColor(event.status),
            borderColor: getStatusColor(event.status),
            extendedProps: {
                type: event.type,
                status: event.status,
                location: event.location,
                description: event.description,
                capacity: event.capacity,
                registered: event.registered,
                organizer: event.organizer,
                isPublic: event.isPublic,
                createdBy: event.createdBy
            }
        }));
        
        res.json({ success: true, events: formattedEvents });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
});

// Get single event by ID
router.get('/api/events/:id', requireAuth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('createdBy', 'firstName lastName email')
            .populate('attendees', 'firstName lastName email');
        
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        res.json({ success: true, event });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch event' });
    }
});

// Create new event
router.post('/api/events', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const {
            title,
            description,
            start,
            end,
            type,
            status,
            location,
            capacity,
            organizer,
            isPublic
        } = req.body;
        
        // Validation
        if (!title || !start) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and start date are required' 
            });
        }
        
        const newEvent = new Event({
            title,
            description: description || '',
            start: new Date(start),
            end: end ? new Date(end) : null,
            type: type || 'General',
            status: status || 'pending',
            location: location || '',
            capacity: capacity || 100,
            registered: 0,
            createdBy: userId,
            organizer: organizer || '',
            isPublic: isPublic !== undefined ? isPublic : true,
            color: getStatusColor(status || 'pending')
        });
        
        await newEvent.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'Event created successfully',
            event: newEvent 
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
});

// Update event
router.put('/api/events/:id', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const updates = req.body;
        
        // Find event and check ownership
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        // Only creator or admin can update
        if (event.createdBy.toString() !== userId && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
        }
        
        // Process date fields
        if (updates.start) updates.start = new Date(updates.start);
        if (updates.end) updates.end = new Date(updates.end);
        
        // Update color based on status
        if (updates.status) {
            updates.color = getStatusColor(updates.status);
        }
        
        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        
        res.json({ 
            success: true, 
            message: 'Event updated successfully',
            event: updatedEvent 
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

// Delete event
router.delete('/api/events/:id', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        // Only creator or admin can delete
        if (event.createdBy.toString() !== userId && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
        }
        
        await Event.findByIdAndDelete(req.params.id);
        
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// Register for event
router.post('/api/events/:id/register', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        // Check if already registered
        if (event.attendees.includes(userId)) {
            return res.status(400).json({ success: false, message: 'Already registered for this event' });
        }
        
        // Check capacity
        if (event.isFull()) {
            return res.status(400).json({ success: false, message: 'Event is at full capacity' });
        }
        
        // Add attendee and increment count
        event.attendees.push(userId);
        event.registered += 1;
        await event.save();
        
        res.json({ success: true, message: 'Registered successfully for the event' });
    } catch (error) {
        console.error('Error registering for event:', error);
        res.status(500).json({ success: false, message: 'Failed to register for event' });
    }
});

// Get dashboard stats
router.get('/api/events/stats/dashboard', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const stats = await Event.getStats(userId);
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

// Get upcoming events
router.get('/api/events/upcoming/list', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { limit = 5 } = req.query;
        
        const upcomingEvents = await Event.getUpcoming(userId, parseInt(limit));
        
        res.json({ success: true, events: upcomingEvents });
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch upcoming events' });
    }
});

// Helper function to get color based on status
function getStatusColor(status) {
    const colors = {
        pending: '#fbbf24',
        active: '#10b981',
        completed: '#8b5cf6',
        cancelled: '#ef4444'
    };
    return colors[status] || '#667eea';
}

module.exports = router;
