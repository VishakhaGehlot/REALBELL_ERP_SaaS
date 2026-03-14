const mongoose=require('mongoose')
mongoose.connect(`${process.env.URL}/${process.env.NAME}`).then(()=>{
console.log(`Mongoose DB Connected ${process.env.NAME}`)
}).catch((error)=>{
console.log(error.message)
})