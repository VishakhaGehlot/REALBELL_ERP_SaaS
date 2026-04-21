const router = require('express').Router();
const Event = require('../models/Event');
const { requireAuth } = require('../middleware/roleAuth');
const { requireModuleAccess } = require('../middleware/permissionAuth');

// Helper function to get user ID from session
const getUserId = (req) => {
    return req.user?._id || req.session?.userId || req.session?.passport?.user;
};

const buildOwnedEventFilter = (req, baseFilter = {}) => {
    const userId = getUserId(req);
    if (!userId) {
        return { _id: null };
    }

    return {
        ...baseFilter,
        createdBy: userId
    };
};

// ==============
// FRONTEND VIEWS
// ==============

// Calendar View - Main Events Page
router.get('/calendar', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const events = await Event.find(buildOwnedEventFilter(req)).sort({ start: 1 }).lean();

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
router.get('/events-list', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const events = await Event.find(buildOwnedEventFilter(req)).sort({ start: -1 }).lean();

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
router.get('/registrations', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const events = await Event.find(buildOwnedEventFilter(req)).sort({ start: -1 }).lean();

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
router.get('/upcoming-events', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const now = new Date();
        const events = await Event.find(buildOwnedEventFilter(req, {
            start: { $gte: now },
            status: { $nin: ['completed', 'cancelled'] }
        })).sort({ start: 1 }).lean();

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
router.get('/api/events', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const { start, end, status, type } = req.query;

        let query = buildOwnedEventFilter(req);

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
router.get('/api/events/:id', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
    try {
        const event = await Event.findOne(buildOwnedEventFilter(req, { _id: req.params.id }))
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
router.post('/api/events', requireAuth, requireModuleAccess('eventsManagement', 'add'), async (req, res) => {
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
            organizer
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
            isPublic: false,
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
router.put('/api/events/:id', requireAuth, requireModuleAccess('eventsManagement', 'edit'), async (req, res) => {
    try {
        const updates = req.body;

        const event = await Event.findOne(buildOwnedEventFilter(req, { _id: req.params.id }));
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Process date fields
        if (updates.start) updates.start = new Date(updates.start);
        if (updates.end) updates.end = new Date(updates.end);
        updates.isPublic = false;

        // Update color based on status
        if (updates.status) {
            updates.color = getStatusColor(updates.status);
        }

        const updatedEvent = await Event.findOneAndUpdate(
            buildOwnedEventFilter(req, { _id: req.params.id }),
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
router.delete('/api/events/:id', requireAuth, requireModuleAccess('eventsManagement', 'delete'), async (req, res) => {
    try {
        const event = await Event.findOne(buildOwnedEventFilter(req, { _id: req.params.id }));
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        await Event.findOneAndDelete(buildOwnedEventFilter(req, { _id: req.params.id }));

        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// Register for event
router.post('/api/events/:id/register', requireAuth, requireModuleAccess('eventsManagement', 'edit'), async (req, res) => {
    try {
        const userId = getUserId(req);

        const event = await Event.findOne(buildOwnedEventFilter(req, { _id: req.params.id }));
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
router.get('/api/events/stats/dashboard', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
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
router.get('/api/events/upcoming/list', requireAuth, requireModuleAccess('eventsManagement', 'view'), async (req, res) => {
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
