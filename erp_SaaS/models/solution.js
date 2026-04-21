const mongoose=require('mongoose')

const solutionSchema=mongoose.Schema({
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
},{
     timestamps:true
})

module.exports=mongoose.model("solution",solutionSchema)
