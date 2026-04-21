const mongoose=require('mongoose')

const footerSchema=mongoose.Schema({
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
     instagramUrl:{
        type:String,
        required:true
     },
     youtubeUrl:{
        type:String,
        required:true
     },
     facebook:{
        type:String,
        required:true
     },
     LinUrl:{
        type:String,
        required:true
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

module.exports=mongoose.model("footer",footerSchema)
