const mongoose=require('mongoose')

const BannerSchema=mongoose.Schema({
     title:{
      type:String,
      required:true
     },
     desc:{
      type:String,
      required:true
     },
     mdesc:{
      type:String,
      required:true
     },
     status:{
          type:String,
          default:"Pending"
     }
})

module.exports=mongoose.model("Banner",BannerSchema)