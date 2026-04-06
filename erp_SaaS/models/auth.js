
const mongoose=require('mongoose')

const authSchema=mongoose.Schema({
    firstName:{
        type:String,
        required:true
    },
     lastName:{
        type:String,
        required:true
    },
     email:{
        type:String,
        required:true,
        unique:true
    },
     password:{
        type:String,
        required:true
    },
      status:{
        type:String,
        enum:["Active","Inactive","Suspended"],
        default:"Suspended"
    },
     
    role:{
        type:String,
        default:"Employee"
    },
    reportsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "auth",
        default: null
    },
     otp: {
        type: String
    },

    // 🔥 OTP EXPIRE TIME
    otpExpire: {
        type: Date
    },
    mobile:{
        type:String,
        required:true
    },
    dob:{
        type:String,
        required:true
    }
})

module.exports=mongoose.model("auth",authSchema)
