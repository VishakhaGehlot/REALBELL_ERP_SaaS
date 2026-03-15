const express =require('express')
const app=express()
require('dotenv').config()
require('./dbconnection/DBconnection')
const session=require('express-session')


app.use(session({
    secret:"Ravi",
    resave:false,
    saveUninitialized:false
}))


app.use(express.urlencoded({ extended: true }));
const authRouter=require('./routers/auth')
const bannerRouter=require('./routers/Banner')
const HomeRouter=require('./routers/Home')
const AccountRouter=require('./routers/Account')
const FaqRouter=require('./routers/faq')
const ManageRouter=require('./routers/Manage')
const queryRouter=require('./routers/query')
const leadsRouter=require('./routers/leads')
const solutionRouter=require('./routers/solution')
const financeRouter=require('./routers/finance')
const userRouter=require('./routers/user')
const premiumsRouter=require('./routers/premiums')
const swiperRouter=require('./routers/swiper')
const footerRouter=require('./routers/footer')







app.use('/',HomeRouter)
app.use('/',authRouter)
app.use('/',bannerRouter)
app.use('/',AccountRouter)
app.use('/',FaqRouter)
app.use('/',ManageRouter)
app.use('/',queryRouter)
app.use('/',leadsRouter)
app.use('/',solutionRouter)
app.use('/',financeRouter)
app.use('/',userRouter)
app.use('/',premiumsRouter)
app.use('/',swiperRouter)
app.use('/',footerRouter)




app.use(express.static('public'))
app.set('view engine','ejs')
app.listen(process.env.PORT,()=>{console.log(`Server is running on port ${process.env.PORT}`)})