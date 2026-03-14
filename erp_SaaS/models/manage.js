const mongoose=require('mongoose')

const ManageSchema=mongoose.Schema({
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
     img:{
        type:String
     }
})

module.exports=mongoose.model("manage",ManageSchema)