const mongoose=require('mongoose')

const swiperSchema=mongoose.Schema({
    
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

module.exports=mongoose.model("swiper",swiperSchema)
