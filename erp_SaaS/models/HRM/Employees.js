const mongoose = require('mongoose');

const employeeSchema = mongoose.Schema({
    // Basic Employee Information
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: null
    },
    
    // Job Details
    department: {
        type: String,
        required: true
    },
    position: {
        type: String,
        required: true
    },
    joiningDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'On Leave'],
        default: "Active"
    },
    
    // Salary Information
    salary: {
        type: Number,
        required: true,
        default: 0
    },
    
    // Address
    address: {
        type: String,
        required: true
    },
    createdByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "auth",
        default: null
    },
    createdByEmail: {
        type: String,
        default: ""
    },

    // Attendance Records
    attendanceRecords: [{
        date: {
            type: Date,
            required: true
        },
        checkIn: {
            type: String,
            default: null
        },
        checkOut: {
            type: String,
            default: null
        },
        workingHours: {
            type: Number,
            default: 0
        },
        attendanceStatus: {
            type: String,
            enum: ['Present', 'Absent', 'Half Day', 'Leave', 'Late'],
            default: 'Present'
        }
    }],
    
    // Leave Records
    leaveRecords: [{
        leaveType: {
            type: String,
            enum: ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Emergency Leave'],
            required: true
        },
        fromDate: {
            type: Date,
            required: true
        },
        toDate: {
            type: Date,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
            default: 'Pending'
        },
        approvedBy: {
            type: String,
            default: null
        },
        approvedDate: {
            type: Date,
            default: null
        },
        comments: {
            type: String,
            default: ''
        },
        appliedDate: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Leave Balance
    leaveBalance: {
        sickLeave: {
            type: Number,
            default: 12
        },
        casualLeave: {
            type: Number,
            default: 10
        },
        earnedLeave: {
            type: Number,
            default: 15
        },
        emergencyLeave: {
            type: Number,
            default: 5
        }
    },
    
    // Payroll Records
    payrollRecords: [{
        month: {
            type: String,
            required: true
        },
        allowances: {
            type: Number,
            default: 0
        },
        deductions: {
            type: Number,
            default: 0
        },
        netSalary: {
            type: Number,
            required: true
        },
        payStatus: {
            type: String,
            enum: ['Pending', 'Processing', 'Paid'],
            default: 'Pending'
        },
        paymentDate: {
            type: Date,
            default: null
        },
        remarks: {
            type: String,
            default: ''
        }
    }]
    
}, {
    timestamps: true
});

module.exports = mongoose.model("HRM", employeeSchema);
