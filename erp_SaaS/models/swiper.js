const mongoose=require('mongoose')

const swiperSchema=mongoose.Schema({
    
     status:{
          type:String,
          default:"Pending"
     },
     img:{
        type:String
     }
})

module.exports=mongoose.model("swiper",swiperSchema)