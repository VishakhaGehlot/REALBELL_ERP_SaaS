// models/ZoomRecording.js
const mongoose = require('mongoose');

const zoomRecordingSchema = new mongoose.Schema({
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoomMeeting', required: true },
    zoomMeetingId: { type: String, required: true }, // The actual string ID from Zoom
    recordingUrl: { type: String, required: true },
    duration: { type: Number, required: true }, // in minutes
    recordingStatus: { type: String, enum: ['Processing', 'Ready'], default: 'Processing' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ZoomRecording', zoomRecordingSchema);
