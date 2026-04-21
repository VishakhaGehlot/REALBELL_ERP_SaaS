const mongoose = require('mongoose')

const querySchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    message: String,
    replied: {
        type: Boolean,
        default: false
    },
    handledByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "auth",
        default: null
    },
    handledByEmail: {
        type: String,
        default: ""
    },
    handledAt: {
        type: Date,
        default: null
    },
    createdDate:{
        type:Date,
        default:Date.now
    }
})

module.exports = mongoose.model("query", querySchema)
