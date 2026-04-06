const mongoose = require("mongoose")

const userPlanSchema = new mongoose.Schema({

name:{
type:String,
required:true
},

email:{
type:String,
required:true
},

phone:{
type:String,
required:true
},

businessName:{
type:String, 
required:true
},
address:{
type:String,
required:true
},
businessType:{
type:String,
required:true
},
businessEmail:{
type:String,
required:true
},
businessPhone:{
type:String,
required:true
},
password:{
type:String,
required:true
},
planId:{
type:mongoose.Schema.Types.ObjectId,
ref:"sunscription"
},
planName:{
type:String,
required:true
},
planPrice:{
type:Number,
required:true
},
razorpayOrderId:{
type:String
},
razorpayPaymentId:{
type:String
},
razorpayPaymentLinkId:{
type:String
},
razorpaySignature:{
type:String
},
paymentMethod:{
type:String,
trim:true
},
paymentStatus:{
type:String,
enum:["Pending","Paid","Failed"],
default:"Pending"
},
subscriptionStatus:{
type:String,
enum:["Pending","Active","Cancelled"],
default:"Pending"
},
paidAt:{
type:Date
}
},{
timestamps:true
})

module.exports = mongoose.model("userPlan",userPlanSchema)