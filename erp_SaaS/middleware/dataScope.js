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

    return {
        role,
        fullAccess: false,
        userIds: [String(user._id)],
        emails: [String(user.email || "").toLowerCase()]
    }
}

function buildOwnedDocumentFilter(req, { idFields = [], emailFields = [] } = {}, baseFilter = {}) {
    const clauses = []
    const userId = req.session && req.session.userId ? req.session.userId : null
    const exactEmail = String(req.session && req.session.email ? req.session.email : "").trim()
    const normalizedEmail = exactEmail.toLowerCase()
    const emailValues = Array.from(new Set([exactEmail, normalizedEmail].filter(Boolean)))

    if (userId) {
        for (const field of idFields) {
            clauses.push({ [field]: userId })
        }
    }

    for (const field of emailFields) {
        for (const value of emailValues) {
            clauses.push({ [field]: value })
        }
    }

    if (!clauses.length) {
        if (!baseFilter || !Object.keys(baseFilter).length) {
            return { _id: null }
        }

        return {
            $and: [
                baseFilter,
                { _id: null }
            ]
        }
    }

    if (!baseFilter || !Object.keys(baseFilter).length) {
        return { $or: clauses }
    }

    return {
        $and: [
            baseFilter,
            { $or: clauses }
        ]
    }
}

module.exports = {
    getCurrentUser,
    getUserScope,
    buildOwnedDocumentFilter
}
