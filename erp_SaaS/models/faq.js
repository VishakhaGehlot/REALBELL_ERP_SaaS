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
     }
})

module.exports=mongoose.model("faq",faqSchema)