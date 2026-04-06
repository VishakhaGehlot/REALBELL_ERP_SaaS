const authTable = require("../models/auth")
const { normalizeRole } = require("./roleAuth")

async function getCurrentUser(req) {
    if (!req.session || !req.session.email) return null

    if (req.scopeUser) return req.scopeUser

    const user = await authTable.findOne({ email: req.session.email }).lean()
    req.scopeUser = user || null
    return req.scopeUser
}

async function getSubordinateIds(rootUserId) {
    const root = String(rootUserId)
    const visited = new Set([root])
    const queue = [root]

    while (queue.length) {
        const parentId = queue.shift()
        const children = await authTable
            .find({ reportsTo: parentId }, { _id: 1 })
            .lean()

        for (const child of children) {
            const childId = String(child._id)
            if (!visited.has(childId)) {
                visited.add(childId)
                queue.push(childId)
            }
        }
    }

    return Array.from(visited)
}

async function getUserScope(req) {
    const user = await getCurrentUser(req)

    if (!user) {
        return {
            role: "Employee",
            fullAccess: false,
            userIds: [],
            emails: []
        }
    }

    const role = normalizeRole(user.role)

    if (role === "SuperAdmin" || role === "CEO") {
        return {
            role,
            fullAccess: true,
            userIds: [String(user._id)],
            emails: [String(user.email || "").toLowerCase()]
        }
    }

    if (role === "Manager" || role === "HR") {
        const scopedIds = await getSubordinateIds(user._id)
        const scopedUsers = await authTable.find(
            { _id: { $in: scopedIds } },
            { email: 1 }
        ).lean()

        return {
            role,
            fullAccess: false,
            userIds: scopedIds,
            emails: scopedUsers
                .map((u) => String(u.email || "").toLowerCase())
                .filter(Boolean)
        }
    }

    return {
        role,
        fullAccess: false,
        userIds: [String(user._id)],
        emails: [String(user.email || "").toLowerCase()]
    }
}

module.exports = {
    getCurrentUser,
    getUserScope
}

