const mongoose = require("mongoose")

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        assignee: {
            type: String,
            default: "",
            trim: true
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High"],
            default: "Medium"
        },
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Completed"],
            default: "Pending"
        },
        dueDate: {
            type: Date,
            default: null
        }
    },
    { _id: false }
)

const milestoneSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        dueDate: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: ["Pending", "Completed"],
            default: "Pending"
        }
    },
    { _id: false }
)

const projectBoardSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        client: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["Planning", "In Progress", "Completed", "On Hold"],
            default: "Planning"
        },
        budget: {
            type: Number,
            default: 0
        },
        progress: {
            type: Number,
            default: 0
        },
        dueDate: {
            type: Date,
            default: null
        },
        teamMembers: {
            type: [String],
            default: []
        },
        tasks: {
            type: [taskSchema],
            default: []
        },
        milestones: {
            type: [milestoneSchema],
            default: []
        },
        createdBy: {
            type: String,
            default: "",
            trim: true
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("ProjectBoard", projectBoardSchema)
