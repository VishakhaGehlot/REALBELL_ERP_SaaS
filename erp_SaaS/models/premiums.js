const mongoose=require('mongoose')

const premiumSchema=mongoose.Schema({
     title:{
      type:String,
      required:true
     },
     status:{
          type:String,
          default:"Pending"
     },
     img:{
        type:String
     }
})

module.exports=mongoose.model("premiums",premiumSchema)