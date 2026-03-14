const mongoose=require('mongoose')

const financeSchema=mongoose.Schema({
     title:{
      type:String,
      required:true
     },
     desc1:{
      type:String,
      required:true
     },
     desc2:{
      type:String,
      required:true
     },
     desc3:{
      type:String,
      required:true
     },
     desc4:{
      type:String,
      required:true
     },
     status:{
          type:String,
          default:"Pending"
     }
})

module.exports=mongoose.model("finance",financeSchema)