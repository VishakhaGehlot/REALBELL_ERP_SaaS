const mongoose=require('mongoose')

const faqSchema=mongoose.Schema({
     title:{
      type:String,
      required:true
     },
     desc:{
      type:String,
      required:true
     },
     status:{
          type:String,
          default:"Pending"
     },
     createdByUserId:{
          type: mongoose.Schema.Types.ObjectId,
          ref: "auth",
          default: null
     },
     createdByEmail:{
          type:String,
          default:""
     }
},{
     timestamps:true
})

module.exports=mongoose.model("faq",faqSchema)
