const mongoose=require('mongoose')

const AccountSchema=mongoose.Schema({
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

module.exports=mongoose.model("Accounting",AccountSchema)
