const mongoose = require("mongoose")

const eventScheduleSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: ["Meeting", "Webinar", "Launch", "Training", "Registration"],
            default: "Meeting"
        },
        venue: {
            type: String,
            default: "",
            trim: true
        },
        startDate: {
            type: Date,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        attendeeName: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["Scheduled", "Upcoming", "Completed", "Registered"],
            default: "Scheduled"
        },
        notes: {
            type: String,
            default: "",
            trim: true
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("EventSchedule", eventScheduleSchema)
