const router = require('express').Router();
const upload = require('../middleware/multer');
const EmployeesTable = require('../models/HRM/Employees');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/roleAuth');
const { requireScopedModuleAccess } = require('../middleware/permissionAuth');
const { getUserScope } = require('../middleware/dataScope');

router.use(requireAuth);
router.use(requireScopedModuleAccess('hrm', [
    '/employees',
    '/addnewemployee',
    '/attendance',
    '/addattendence',
    '/leave',
    '/addleave',
    '/payroll',
    '/addpayroll'
]));

function buildEmployeeScopeFilter(scope) {
    if (scope.fullAccess) return {}
    return {
        $or: [
            { email: { $in: scope.emails } },
            { createdByUserId: { $in: scope.userIds } },
            { createdByEmail: { $in: scope.emails } }
        ]
    }
}

// ==================== EMPLOYEE ROUTES ====================

// Get all employees
router.get("/employees", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employeeFilter = buildEmployeeScopeFilter(scope)
        const record = await EmployeesTable.find(employeeFilter).sort({ createdAt: -1 });
        
        const activeCount = await EmployeesTable.countDocuments({ ...employeeFilter, status: 'Active' });
        const onLeaveCount = await EmployeesTable.countDocuments({ ...employeeFilter, status: 'On Leave' });
        const departments = await EmployeesTable.distinct('department', employeeFilter);
        const departmentCount = departments.length;
        const loginname = req.session.email;

        res.render("HRM/Employees", {
            record,
            totalEmployees: record.length,
            activeCount,
            onLeaveCount,
            departmentCount,
            loginname
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Get single employee
router.get("/employees/:id", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.id,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json(employee);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Show add employee form
router.get("/AddNewEmployee", (req, res) => {
    res.render("HRM/AddNewEmployee", { loginname: req.session.email });
});

// Add new employee
router.post("/AddNewEmployee", upload.single("image"), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const fileName = req.file ? req.file.filename : null;
        const { name, email, phone, department, position, joiningDate, salary, address, status } = req.body;
        
        if (!name || !email || !department || !position) {
            return res.status(400).send('Required fields missing');
        }
        
        const employeeData = {
            name, email, phone: phone || '', department, position,
            joiningDate: joiningDate || new Date(),
            salary: salary || 0, address: address || '',
            status: status || 'Active', image: fileName,
            createdByUserId: scope.userIds[0] || null,
            createdByEmail: (req.session.email || '').toLowerCase(),
            attendanceRecords: [], payrollRecords: [], leaveRecords: [],
            leaveBalance: { sickLeave: 12, casualLeave: 10, earnedLeave: 15, emergencyLeave: 5 }
        };
        
        const newEmployee = new EmployeesTable(employeeData);
        await newEmployee.save();
        res.redirect("/employees");
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving employee: ' + error.message);
    }
});

// Show edit employee form
router.get("/employees/edit/:id", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.id,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).send('Employee not found');
        res.render("HRM/EditEmployee", { employee });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Update employee
router.post("/employees/update/:id", upload.single("image"), async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const updateData = {
            name: req.body.name, email: req.body.email, phone: req.body.phone,
            department: req.body.department, position: req.body.position,
            joiningDate: req.body.joiningDate, salary: req.body.salary,
            address: req.body.address, status: req.body.status
        };
        if (req.file) updateData.image = req.file.filename;
        await EmployeesTable.findOneAndUpdate({
            _id: req.params.id,
            ...buildEmployeeScopeFilter(scope)
        }, updateData);
        res.redirect("/employees");
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating employee');
    }
});

// Delete employee
router.delete("/employees/delete/:id", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        await EmployeesTable.findOneAndDelete({
            _id: req.params.id,
            ...buildEmployeeScopeFilter(scope)
        });
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error deleting employee' });
    }
});

// Export employees to CSV
router.get("/employees/export", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        let csv = "ID,Name,Email,Phone,Department,Position,Salary,Join Date,Address,Status\n";
        employees.forEach((emp, index) => {
            csv += `${index + 1},${emp.name},${emp.email},${emp.phone || ''},${emp.department},${emp.position},${emp.salary || 0},${emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : ''},${emp.address || ''},${emp.status || 'Active'}\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=employees.csv');
        res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error exporting data');
    }
});

// ==================== ATTENDANCE ROUTES ====================

// Get attendance page
router.get("/attendance", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        let attendanceList = [];
        
        employees.forEach(emp => {
            if (emp.attendanceRecords && emp.attendanceRecords.length > 0) {
                emp.attendanceRecords.forEach(record => {
                    attendanceList.push({
                        employeeId: emp._id, employeeName: emp.name,
                        employeeDepartment: emp.department, employeeImage: emp.image,
                        date: record.date, checkIn: record.checkIn, checkOut: record.checkOut,
                        workingHours: record.workingHours, attendanceStatus: record.attendanceStatus
                    });
                });
            }
        });
        
        attendanceList.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let present = 0, absent = 0, late = 0, halfDay = 0, onLeave = 0;
        
        employees.forEach(emp => {
            const todayRecord = emp.attendanceRecords?.find(record => 
                new Date(record.date).toDateString() === today.toDateString()
            );
            if (todayRecord) {
                switch(todayRecord.attendanceStatus) {
                    case 'Present': present++; break;
                    case 'Absent': absent++; break;
                    case 'Late': late++; break;
                    case 'Half Day': halfDay++; break;
                    case 'Leave': onLeave++; break;
                    default: absent++; break;
                }
            } else { absent++; }
        });
        
        res.render("HRM/Attendance", {
            attendanceList,
            attendanceSummary: { total: employees.length, present, absent, late, halfDay, onLeave },
            loginname: req.session.email
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Show add attendance form
router.get('/addattendence', async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find({
            ...buildEmployeeScopeFilter(scope),
            status: 'Active'
        });
        res.render('HRM/addattendence', { employees, loginname: req.session.email });
    } catch (error) {
        console.log(error);
        res.send("Error loading form");
    }
});

// Add new attendance record
router.post('/addattendence', async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const { employeeId, date, checkIn, checkOut, workingHours, attendanceStatus } = req.body;
        const employee = await EmployeesTable.findOne({
            _id: employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.send("Employee not found");
        
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);
        const existingAttendance = employee.attendanceRecords.find(record => 
            new Date(record.date).toDateString() === attendanceDate.toDateString()
        );
        
        if (existingAttendance) {
            existingAttendance.checkIn = checkIn || null;
            existingAttendance.checkOut = checkOut || null;
            existingAttendance.workingHours = workingHours || 0;
            existingAttendance.attendanceStatus = attendanceStatus || 'Present';
        } else {
            employee.attendanceRecords.push({
                date: attendanceDate, checkIn: checkIn || null, checkOut: checkOut || null,
                workingHours: workingHours || 0, attendanceStatus: attendanceStatus || 'Present'
            });
        }
        await employee.save();
        res.redirect('/attendance');
    } catch (error) {
        console.log(error);
        res.send("Error saving attendance");
    }
});

// ==================== LEAVE ROUTES ====================

// Get leave management page
router.get("/leave", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        let leaveRecords = [];
        
        employees.forEach(emp => {
            if (emp.leaveRecords && emp.leaveRecords.length > 0) {
                emp.leaveRecords.forEach(record => {
                    leaveRecords.push({
                        _id: record._id, employeeId: emp._id, employeeName: emp.name,
                        employeeDepartment: emp.department, employeeImage: emp.image,
                        employeeEmail: emp.email, employeePhone: emp.phone,
                        leaveType: record.leaveType, fromDate: record.fromDate,
                        toDate: record.toDate, duration: record.duration,
                        reason: record.reason, status: record.status,
                        appliedDate: record.appliedDate || record.createdAt || new Date(),
                        approvedBy: record.approvedBy, approvedDate: record.approvedDate,
                        comments: record.comments
                    });
                });
            }
        });
        
        leaveRecords.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
        
        const totalRequests = leaveRecords.length;
        const pendingCount = leaveRecords.filter(r => r.status === 'Pending').length;
        const approvedCount = leaveRecords.filter(r => r.status === 'Approved').length;
        const rejectedCount = leaveRecords.filter(r => r.status === 'Rejected').length;
        
        res.render("HRM/LeaveManage", {
            leaveRecords, totalRequests, pendingCount, approvedCount, rejectedCount,
            loginname: req.session.email || 'Admin'
        });
    } catch (error) {
        console.error(error);
        res.render("HRM/LeaveManage", {
            leaveRecords: [], totalRequests: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0,
            loginname: req.session.email || 'Admin'
        });
    }
});

// Get add leave form (only absent employees)
router.get('/addleave', async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let absentEmployees = [];
        
        employees.forEach(emp => {
            const todayRecord = emp.attendanceRecords?.find(record =>
                new Date(record.date).toDateString() === today.toDateString()
            );
            if (!todayRecord || ['Absent', 'Leave', 'Half Day'].includes(todayRecord.attendanceStatus)) {
                absentEmployees.push(emp);
            }
        });
        
        res.render("HRM/addleave", { employees: absentEmployees, loginname: req.session.email || 'Admin' });
    } catch (error) {
        console.log(error);
        res.status(500).send("Error loading leave form: " + error.message);
    }
});

// Add new leave record
router.post('/addleave', async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const { employeeId, leaveType, fromDate, toDate, duration, reason, leaveStatus } = req.body;
        if (!employeeId || !leaveType || !fromDate || !toDate || !reason) {
            return res.status(400).send('Required fields missing');
        }
        
        const employee = await EmployeesTable.findOne({
            _id: employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).send('Employee not found');
        
        const existingLeave = employee.leaveRecords?.find(record => 
            (new Date(record.fromDate) <= new Date(toDate) && new Date(record.toDate) >= new Date(fromDate))
        );
        if (existingLeave) return res.status(400).send('Leave already exists for this period');
        
        if (!employee.leaveRecords) employee.leaveRecords = [];
        
        employee.leaveRecords.push({
            leaveType, fromDate: new Date(fromDate), toDate: new Date(toDate),
            duration: parseInt(duration) || 1, reason, status: leaveStatus || 'Pending',
            approvedBy: null, approvedDate: null, comments: null, appliedDate: new Date()
        });
        
        await employee.save();
        res.redirect('/leave');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving leave application: ' + error.message);
    }
});

// Get single leave record
router.get("/leave/:employeeId/:leaveId", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        const leaveRecord = employee.leaveRecords.id(req.params.leaveId);
        if (!leaveRecord) return res.status(404).json({ error: 'Leave record not found' });
        
        res.json({
            employeeName: employee.name, employeeDepartment: employee.department,
            employeeEmail: employee.email, employeePhone: employee.phone,
            leaveType: leaveRecord.leaveType, fromDate: leaveRecord.fromDate,
            toDate: leaveRecord.toDate, duration: leaveRecord.duration,
            reason: leaveRecord.reason, status: leaveRecord.status,
            appliedDate: leaveRecord.appliedDate, approvedBy: leaveRecord.approvedBy,
            approvedDate: leaveRecord.approvedDate, comments: leaveRecord.comments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Approve leave
router.put("/leave/approve/:employeeId/:leaveId", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        const leaveRecord = employee.leaveRecords.id(req.params.leaveId);
        if (!leaveRecord) return res.status(404).json({ error: 'Leave record not found' });
        
        leaveRecord.status = 'Approved';
        leaveRecord.approvedBy = req.session.email || 'Admin';
        leaveRecord.approvedDate = new Date();
        leaveRecord.comments = req.body.comments || '';
        
        if (employee.leaveBalance) {
            switch(leaveRecord.leaveType) {
                case 'Sick Leave': employee.leaveBalance.sickLeave -= leaveRecord.duration; break;
                case 'Casual Leave': employee.leaveBalance.casualLeave -= leaveRecord.duration; break;
                case 'Earned Leave': employee.leaveBalance.earnedLeave -= leaveRecord.duration; break;
                case 'Emergency Leave': employee.leaveBalance.emergencyLeave -= leaveRecord.duration; break;
            }
        }
        
        await employee.save();
        res.json({ success: true, message: 'Leave approved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error approving leave' });
    }
});

// Reject leave
router.put("/leave/reject/:employeeId/:leaveId", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        const leaveRecord = employee.leaveRecords.id(req.params.leaveId);
        if (!leaveRecord) return res.status(404).json({ error: 'Leave record not found' });
        
        leaveRecord.status = 'Rejected';
        leaveRecord.approvedBy = req.session.email || 'Admin';
        leaveRecord.approvedDate = new Date();
        leaveRecord.comments = req.body.comments || '';
        
        await employee.save();
        res.json({ success: true, message: 'Leave rejected successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error rejecting leave' });
    }
});

// Delete leave record
router.delete("/leave/delete/:employeeId/:leaveId", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        employee.leaveRecords = employee.leaveRecords.filter(record => record._id.toString() !== req.params.leaveId);
        await employee.save();
        
        res.json({ success: true, message: 'Leave record deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error deleting leave' });
    }
});

// ==================== PAYROLL ROUTES ====================

// Show all payroll records
router.get("/payroll", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        let allPayrollRecords = [];
        
        employees.forEach(emp => {
            if (emp.payrollRecords && emp.payrollRecords.length > 0) {
                emp.payrollRecords.forEach(record => {
                    allPayrollRecords.push({
                        employeeId: emp._id, employeeName: emp.name,
                        employeeDepartment: emp.department, basicSalary: emp.salary,
                        ...record.toObject()
                    });
                });
            }
        });
        
        allPayrollRecords.sort((a, b) => b.month.localeCompare(a.month));
        res.render("HRM/Payroll", { payrollRecords: allPayrollRecords, loginname: req.session.email });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Show add payroll form
router.get("/addpayroll", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find({
            ...buildEmployeeScopeFilter(scope),
            status: 'Active'
        });
        res.render("HRM/addpayroll", { employees, loginname: req.session.email });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Add new payroll record
router.post("/addpayroll", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const { employeeId, month, allowances, deductions, netSalary, payStatus, paymentDate, remarks } = req.body;
        if (!employeeId || !month || !netSalary) return res.status(400).send('Required fields missing');
        
        const employee = await EmployeesTable.findOne({
            _id: employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).send('Employee not found');
        
        if (employee.payrollRecords.find(record => record.month === month)) {
            return res.status(400).send('Payroll already exists for this employee in this month');
        }
        
        employee.payrollRecords.push({
            month, allowances: parseFloat(allowances) || 0, deductions: parseFloat(deductions) || 0,
            netSalary: parseFloat(netSalary), payStatus: payStatus || 'Pending',
            paymentDate: paymentDate || null, remarks: remarks || ''
        });
        
        await employee.save();
        res.redirect("/payroll");
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving payroll: ' + error.message);
    }
});

// Update payroll status
router.put("/payroll/update/:employeeId/:month", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        const payrollRecord = employee.payrollRecords.find(record => record.month === req.params.month);
        if (!payrollRecord) return res.status(404).json({ error: 'Payroll record not found' });
        
        payrollRecord.payStatus = req.body.payStatus;
        if (req.body.paymentDate) payrollRecord.paymentDate = req.body.paymentDate;
        
        await employee.save();
        res.json({ success: true, message: 'Payroll updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error updating payroll' });
    }
});

// Delete payroll record
router.delete("/payroll/delete/:employeeId/:month", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employee = await EmployeesTable.findOne({
            _id: req.params.employeeId,
            ...buildEmployeeScopeFilter(scope)
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        employee.payrollRecords = employee.payrollRecords.filter(record => record.month !== req.params.month);
        await employee.save();
        
        res.json({ success: true, message: 'Payroll record deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error deleting payroll' });
    }
});

// Export payroll to CSV
router.get("/payroll/export", async (req, res) => {
    try {
        const scope = await getUserScope(req)
        const employees = await EmployeesTable.find(buildEmployeeScopeFilter(scope));
        let csv = "Employee Name,Department,Month,Basic Salary,Allowances,Deductions,Net Salary,Status,Payment Date,Remarks\n";
        
        employees.forEach(emp => {
            if (emp.payrollRecords && emp.payrollRecords.length > 0) {
                emp.payrollRecords.forEach(record => {
                    csv += `${emp.name},${emp.department},${record.month},${emp.salary},${record.allowances},${record.deductions},${record.netSalary},${record.payStatus},${record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : 'N/A'},${record.remarks || 'N/A'}\n`;
                });
            }
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payroll.csv');
        res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error exporting data');
    }
});

module.exports = router;
