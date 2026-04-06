const mongoose = require("mongoose")

const ALLOWED_PERMISSION_ROLES = [
    "superadmin",
    "company",
    "employee",
    "customer",
    "vendor"
]

function normalizePermissionRole(role) {
    const value = String(role || "").trim().toLowerCase()
    if (value === "superadmin" || value === "super_admin") return "superadmin"
    if (value === "company" || value === "organisation" || value === "organization") return "company"
    if (value === "employee" || value === "employyee" || value === "staff" || value === "user" || value === "teacher") return "employee"
    if (value === "customer" || value === "client") return "customer"
    if (value === "vendor" || value === "vender" || value === "supplier") return "vendor"
    return "employee"
}

const rolePermissionSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            required: true,
            unique: true,
            enum: ALLOWED_PERMISSION_ROLES,
            set: normalizePermissionRole
        },
        permissions: {
            subscription: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            crm: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            hrm: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            queryManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            frontendManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            productManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            accounting: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            pos: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            salesManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            projectManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            leadManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            dealManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            smsManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            emailNotification: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            eventsManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            zoomMeeting: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            },
            supportDeskManagement: {
                view: { type: Boolean, default: false },
                add: { type: Boolean, default: false },
                edit: { type: Boolean, default: false },
                delete: { type: Boolean, default: false }
            }
        }
    },
    { timestamps: true }
)

rolePermissionSchema.statics.normalizePermissionRole = normalizePermissionRole
rolePermissionSchema.statics.ALLOWED_PERMISSION_ROLES = ALLOWED_PERMISSION_ROLES

module.exports = mongoose.model("RolePermission", rolePermissionSchema)
