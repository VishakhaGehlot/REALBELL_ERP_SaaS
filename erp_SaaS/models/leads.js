const mongoose=require('mongoose')

const LeadsSchema=mongoose.Schema({
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
})

module.exports=mongoose.model("leads",LeadsSchema)
