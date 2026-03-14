const router = require('express').Router()
const upload = require('../middleware/multer')
const footertable = require('../models/footer')

router.get('/footertable', async (req, res) => {
    const footerdata = await footertable.find()
     const loginname=req.session.email
    res.render("footertable.ejs", { footerdata, loginname })
})

router.get('/footerform', (req, res) => {
    res.render("footerform.ejs")
})

router.post('/footerform', upload.single('img'), async (req, res) => {

    const { title, desc, instagram, youtube, facebook, linkedin } = req.body

    const imageFile = req.file ? req.file.filename : ""

    const Record = new footertable({
        title: title,
        desc: desc,
        img: imageFile,
        instagramUrl: instagram,
        youtubeUrl: youtube,
        facebook: facebook,
        LinUrl: linkedin
    })

    await Record.save()

    res.redirect("/footertable")
})


router.get('/footerstatus/:id/:status', async (req, res) => {

    const id = req.params.id
    const currentStatus = req.params.status

    let newStatus = ""

    if (currentStatus == "Pending") {
        newStatus = "Active"
    } else {
        newStatus = "Pending"
    }

    await footertable.findByIdAndUpdate(id, { status: newStatus })

    res.redirect("/footertable")

})


router.get('/footerdelete/:id', async (req, res) => {

    const id = req.params.id

    await footertable.findByIdAndDelete(id)

    res.redirect("/footertable")

})


router.get('/footeredit/:id', async (req, res) => {

    const id = req.params.id

    const Record = await footertable.findById(id)

    res.render("footeredit.ejs", { Record })

})


router.post('/footeredit/:id', upload.single('img'), async (req, res) => {

    const { title, desc, instagram, youtube, facebook, linkedin } = req.body

    const id = req.params.id

    let updateData = {
        title: title,
        desc: desc,
        instagramUrl: instagram,
        youtubeUrl: youtube,
        facebook: facebook,
        LinUrl: linkedin
    }

    if (req.file) {
        updateData.img = req.file.filename
    }

    await footertable.findByIdAndUpdate(id, updateData)

    res.redirect("/footertable")

})

module.exports = router