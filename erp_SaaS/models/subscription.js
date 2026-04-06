const mongoose=require('mongoose')

const subSchema=mongoose.Schema({
    title:{
        type:String,
        required:true
    },
     price:{
        type:String,
        required:true
    },
    features:{
    type:[String],
    required:true
},
     Status:{
        type:String,
        default:"Pending"
    }
})

module.exports=mongoose.model("subscription",subSchema)