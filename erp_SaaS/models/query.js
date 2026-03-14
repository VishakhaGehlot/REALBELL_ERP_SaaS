const mongoose = require('mongoose')

const querySchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    message: String,
})

module.exports = mongoose.model("query", querySchema)