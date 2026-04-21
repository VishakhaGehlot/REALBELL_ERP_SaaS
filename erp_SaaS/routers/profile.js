const router = require('express').Router()
const authTable = require('../models/auth')
const bcrypt = require('bcrypt')
const { requireAuth } = require('../middleware/roleAuth')

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'Not provided'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })
}

// ================= PROFILE PAGE =================
router.get("/profile", requireAuth, async (req, res) => {
    
    try {
        const user = await authTable.findOne({ email: req.session.email })
        
        if (!user) {
            return res.redirect('/login')
        }
        
        const userData = {
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userRole: user.role,
            userMobile: user.mobile || 'Not provided',
            userDOB: user.dob,
            userStatus: user.status,
            userId: user._id,
            createdAt: user.createdAt,
            userInitial: user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U',
            userInitials: user.firstName && user.lastName ? 
                `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 
                (user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'),
            message: req.query.message || null,
            messageType: req.query.messageType || null,
            formatDate: formatDate
        }
        
        res.render("Profile/profile", userData)
    } catch (error) {
        console.error('Profile error:', error)
        res.redirect('/dashboard?message=Error loading profile&messageType=danger')
    }
})

// ================= EDIT PROFILE PAGE =================
router.get("/editprofile", requireAuth, async (req, res) => {
    try {
        const user = await authTable.findOne({ email: req.session.email })
        
        if (!user) {
            return res.redirect('/login')
        }
        
        const userData = {
            firstName: user.firstName,
            lastName: user.lastName,
            userEmail: user.email,
            userMobile: user.mobile || '',
            userDOB: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
            userInitials: user.firstName && user.lastName ? 
                `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : 
                (user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'),
            message: req.query.message || null,
            messageType: req.query.messageType || null
        }
        
        res.render("Profile/EditProfile", userData)
    } catch (error) {
        console.error('Edit profile error:', error)
        res.redirect('/profile?message=Error loading edit form&messageType=danger')
    }
})

// ================= UPDATE PROFILE =================
router.post("/editprofile", requireAuth, async (req, res) => {
    try {
        const { firstName, lastName, mobile, dob } = req.body
        
        if (!firstName || !lastName) {
            return res.redirect('/editprofile?message=First name and last name are required&messageType=danger')
        }
        
        const updatedUser = await authTable.findOneAndUpdate(
            { email: req.session.email },
            {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                mobile: mobile,
                dob: dob
            },
            { new: true }
        )
        
        req.session.userName = `${firstName} ${lastName}`
        
        console.log('Profile updated successfully:', updatedUser.email)
        
        res.redirect('/profile?message=Profile updated successfully!&messageType=success')
        
    } catch (error) {
        console.error('Update profile error:', error)
        res.redirect('/editprofile?message=Failed to update profile&messageType=danger')
    }
})

// ================= CHANGE PASSWORD PAGE (GET) =================
router.get("/change-password", requireAuth, async (req, res) => {
    res.render("Profile/changepassword", { 
        message: req.query.message || null,
        messageType: req.query.messageType || null
    })
})

// ================= CHANGE PASSWORD (POST) =================
router.post("/change-password", requireAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        
        // Get user from database
        const user = await authTable.findOne({ email: req.session.email })
        
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }
        
        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password)
        
        if (!isMatch) {
            return res.json({ success: false, message: "Current password is incorrect" })
        }
        
        // Validate new password
        if (newPassword.length < 8) {
            return res.json({ success: false, message: "New password must be at least 8 characters" })
        }
        
        // Check if new password is same as old
        const isSame = await bcrypt.compare(newPassword, user.password)
        if (isSame) {
            return res.json({ success: false, message: "New password cannot be same as current password" })
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        
        // Update password
        await authTable.findByIdAndUpdate(user._id, { password: hashedPassword })
        
        console.log('Password changed successfully for:', user.email)
        
        return res.json({ 
            success: true, 
            message: "Password changed successfully! Redirecting to login..." 
        })
        
    } catch (error) {
        console.error('Change password error:', error)
        return res.json({ success: false, message: "Error changing password. Please try again." })
    }
})




module.exports = router