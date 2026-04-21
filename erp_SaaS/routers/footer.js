const router = require('express').Router()
const upload = require('../middleware/multer')
const footertable = require('../models/footer')
const { requireAuth } = require('../middleware/roleAuth')
const { requireScopedModuleAccess } = require('../middleware/permissionAuth')
const { buildOwnedDocumentFilter } = require('../middleware/dataScope')

router.use(requireAuth)
router.use(requireScopedModuleAccess('frontendManagement', [
    '/footertable',
    '/footerform',
    '/footerstatus',
    '/footerdelete',
    '/footeredit'
]))

function buildFooterScopeFilter(req, baseFilter = {}) {
    return buildOwnedDocumentFilter(req, {
        idFields: ['createdByUserId'],
        emailFields: ['createdByEmail']
    }, baseFilter)
}

router.get('/footertable', async (req, res) => {
    const footerdata = await footertable.find(buildFooterScopeFilter(req))
     const loginname=req.session.email
    res.render("Frontend/Footer/footertable.ejs", { footerdata, loginname })
})

router.get('/footerform', (req, res) => {
    const loginname=req.session.email
    res.render("Frontend/Footer/footerform.ejs",{loginname})
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
        LinUrl: linkedin,
        createdByUserId: req.session?.userId || null,
        createdByEmail: String(req.session?.email || '').toLowerCase()
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

    await footertable.findOneAndUpdate(buildFooterScopeFilter(req, { _id: id }), { status: newStatus })

    res.redirect("/footertable")

})


router.get('/footerdelete/:id', async (req, res) => {

    const id = req.params.id

    await footertable.findOneAndDelete(buildFooterScopeFilter(req, { _id: id }))

    res.redirect("/footertable")

})


router.get('/footeredit/:id', async (req, res) => {

    const id = req.params.id

    const Record = await footertable.findOne(buildFooterScopeFilter(req, { _id: id }))
         const loginname=req.session.email


    res.render("Frontend/Footer/footeredit.ejs", { Record,loginname })

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

    await footertable.findOneAndUpdate(buildFooterScopeFilter(req, { _id: id }), updateData)

    res.redirect("/footertable")

})

module.exports = router
