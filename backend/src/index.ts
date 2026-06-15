import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT) || 9000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const QR_SECRET = 'qr_token_secret_key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper: Haversine distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Helpers for Cambodia (UTC+7) timezone
function getCambodiaTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getTime() + 7 * 60 * 60 * 1000);
}

function formatCambodiaTime(date: Date | string) {
  const kh = getCambodiaTime(date);
  const h = kh.getUTCHours().toString().padStart(2, '0');
  const m = kh.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    name: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user as AuthenticatedRequest['user'];
    next();
  });
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, departmentId } = req.body;

    if (!name || !email || !password || !departmentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await prisma.employee.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE,
        departmentId,
      },
    });

    res.status(201).json({ message: 'User registered successfully', userId: employee.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { department: true, branch: true }
    });

    if (!employee || !(await bcrypt.compare(password, employee.password))) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role, name: employee.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department.name,
        departmentId: employee.departmentId,
        branchId: employee.branchId,
        branchName: employee.branch?.name || null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user?.id },
      include: { department: true, branch: true }
    });
    if (!employee) return res.status(404).json({ error: 'User not found' });
    res.json(employee);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. DEPARTMENT ROUTES
// ==========================================

app.get('/api/departments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/departments', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Department already exists' });

    const department = await prisma.department.create({ data: { name } });
    res.status(201).json(department);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/departments/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { name }
    });
    res.json(department);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const deptId = req.params.id;

    // Check if department has employees
    const employeesCount = await prisma.employee.count({ where: { departmentId: deptId } });
    if (employeesCount > 0) {
      return res.status(400).json({ error: 'Cannot delete department with active employees. Transfer them first.' });
    }

    await prisma.department.delete({ where: { id: deptId } });
    res.json({ message: 'Department deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. EMPLOYEE & MOVEMENT ROUTES
// ==========================================

app.get('/api/employees', authenticateToken, async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { department: true, branch: true },
      orderBy: { name: 'asc' }
    });
    res.json(employees);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      name, email, password, role, departmentId, branchId,
      employeeIdCode, photo, gender, nationality, phone, jobTitle, dob, dateOfEmployment 
    } = req.body;

    if (!name || !email || !password || !departmentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    if (employeeIdCode) {
      const codeExists = await prisma.employee.findUnique({ where: { employeeIdCode } });
      if (codeExists) {
        return res.status(400).json({ error: 'Employee ID Code already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE,
        departmentId,
        branchId: branchId || null,
        employeeIdCode,
        photo,
        gender,
        nationality,
        phone,
        jobTitle,
        dob,
        dateOfEmployment
      },
      include: { department: true, branch: true }
    });

    res.status(201).json(employee);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      name, email, role, departmentId, branchId, password,
      employeeIdCode, photo, gender, nationality, phone, jobTitle, dob, dateOfEmployment 
    } = req.body;
    const employeeId = req.params.id;

    const currentEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!currentEmployee) return res.status(404).json({ error: 'Employee not found' });

    // Verify email uniqueness if changed
    if (email && email !== currentEmployee.email) {
      const emailExists = await prisma.employee.findUnique({ where: { email } });
      if (emailExists) return res.status(400).json({ error: 'Email already exists' });
    }

    // Verify Employee ID Code uniqueness if changed
    if (employeeIdCode && employeeIdCode !== currentEmployee.employeeIdCode) {
      const codeExists = await prisma.employee.findUnique({ where: { employeeIdCode } });
      if (codeExists) {
        return res.status(400).json({ error: 'Employee ID Code already exists' });
      }
    }

    const data: any = { 
      name, 
      email, 
      role: role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE,
      branchId: branchId || null,
      employeeIdCode,
      photo,
      gender,
      nationality,
      phone,
      jobTitle,
      dob,
      dateOfEmployment
    };

    // Update password if provided (non-empty)
    if (password && password.trim() !== '') {
      data.password = await bcrypt.hash(password, 10);
    }

    // Check for Department Movement
    if (departmentId && departmentId !== currentEmployee.departmentId) {
      data.departmentId = departmentId;

      // Log movement history
      await prisma.employeeMovement.create({
        data: {
          employeeId,
          fromDeptId: currentEmployee.departmentId,
          toDeptId: departmentId,
        }
      });
    }

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data,
      include: { department: true, branch: true }
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ message: 'Employee deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/movements', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const movements = await prisma.employeeMovement.findMany({
      include: {
        employee: { select: { name: true, email: true } },
        fromDepartment: { select: { name: true } },
        toDepartment: { select: { name: true } }
      },
      orderBy: { movedAt: 'desc' }
    });
    res.json(movements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SHIFT & SCHEDULE ROUTES
// ==========================================

app.get('/api/timetables', authenticateToken, async (req: Request, res: Response) => {
  try {
    const timetables = await prisma.timetable.findMany({ orderBy: { name: 'asc' } });
    res.json(timetables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timetables', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, onDutyTime, offDutyTime, beginningIn, endingIn, beginningOut, endingOut, lateTime, leaveEarly, workdayCount, color, mustIn, mustOut } = req.body;
    if (!name || !onDutyTime || !offDutyTime) {
      return res.status(400).json({ error: 'Name, On-Duty, and Off-Duty times are required' });
    }
    const timetable = await prisma.timetable.create({
      data: {
        name,
        onDutyTime,
        offDutyTime,
        beginningIn: beginningIn || '07:00',
        endingIn: endingIn || '09:30',
        beginningOut: beginningOut || '11:00',
        endingOut: endingOut || '13:00',
        lateTime: Number(lateTime !== undefined ? lateTime : 15),
        leaveEarly: Number(leaveEarly !== undefined ? leaveEarly : 15),
        workdayCount: Number(workdayCount !== undefined ? workdayCount : 1.0),
        color: color || '#3b82f6',
        mustIn: mustIn !== undefined ? Boolean(mustIn) : true,
        mustOut: mustOut !== undefined ? Boolean(mustOut) : true
      }
    });
    res.status(201).json(timetable);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/timetables/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, onDutyTime, offDutyTime, beginningIn, endingIn, beginningOut, endingOut, lateTime, leaveEarly, workdayCount, color, mustIn, mustOut } = req.body;
    const timetable = await prisma.timetable.update({
      where: { id: req.params.id },
      data: {
        name,
        onDutyTime,
        offDutyTime,
        beginningIn,
        endingIn,
        beginningOut,
        endingOut,
        lateTime: Number(lateTime),
        leaveEarly: Number(leaveEarly),
        workdayCount: Number(workdayCount),
        color,
        mustIn: Boolean(mustIn),
        mustOut: Boolean(mustOut)
      }
    });
    res.json(timetable);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/timetables/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.timetable.delete({ where: { id: req.params.id } });
    res.json({ message: 'Timetable deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/shifts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        dayTimetables: {
          include: { timetable: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(shifts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/shifts', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, dayTimetables, startTime, endTime, gracePeriod } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Shift name is required' });
    }
    const firstTimeStr = startTime || '08:00';
    const lastTimeStr = endTime || '17:00';

    const shift = await prisma.shift.create({
      data: {
        name,
        startTime: firstTimeStr,
        endTime: lastTimeStr,
        gracePeriod: Number(gracePeriod || 15)
      }
    });

    if (dayTimetables && Array.isArray(dayTimetables)) {
      for (const dt of dayTimetables) {
        await prisma.shiftDayTimetable.create({
          data: {
            shiftId: shift.id,
            dayOfWeek: Number(dt.dayOfWeek),
            timetableId: dt.timetableId
          }
        });
      }
    }

    const updatedShift = await prisma.shift.findUnique({
      where: { id: shift.id },
      include: { dayTimetables: { include: { timetable: true } } }
    });

    res.status(201).json(updatedShift);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/shifts/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, dayTimetables, startTime, endTime, gracePeriod } = req.body;
    const shift = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        name,
        startTime: startTime || '08:00',
        endTime: endTime || '17:00',
        gracePeriod: Number(gracePeriod || 15)
      }
    });

    if (dayTimetables && Array.isArray(dayTimetables)) {
      await prisma.shiftDayTimetable.deleteMany({
        where: { shiftId: req.params.id }
      });

      for (const dt of dayTimetables) {
        await prisma.shiftDayTimetable.create({
          data: {
            shiftId: shift.id,
            dayOfWeek: Number(dt.dayOfWeek),
            timetableId: dt.timetableId
          }
        });
      }
    }

    const updatedShift = await prisma.shift.findUnique({
      where: { id: shift.id },
      include: { dayTimetables: { include: { timetable: true } } }
    });

    res.json(updatedShift);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/shifts/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.json({ message: 'Shift deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/schedules', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        employee: { select: { name: true, email: true, departmentId: true } },
        shift: {
          include: {
            dayTimetables: {
              include: { timetable: true }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });
    res.json(schedules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedules', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { employeeId, shiftId, date, startDate, endDate } = req.body;
    if (!employeeId || !shiftId) {
      return res.status(400).json({ error: 'Missing employeeId or shiftId' });
    }

    const assignForDate = async (targetDateStr: string) => {
      const targetDate = new Date(targetDateStr);
      targetDate.setHours(0, 0, 0, 0);

      const existing = await prisma.schedule.findFirst({
        where: {
          employeeId,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      });

      if (existing) {
        return await prisma.schedule.update({
          where: { id: existing.id },
          data: { shiftId }
        });
      } else {
        return await prisma.schedule.create({
          data: { employeeId, shiftId, date: targetDate }
        });
      }
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const results = [];
      let current = new Date(start);
      while (current <= end) {
        const resObj = await assignForDate(current.toISOString().split('T')[0]);
        results.push(resObj);
        current.setDate(current.getDate() + 1);
      }
      return res.status(201).json({ count: results.length, schedules: results });
    } else if (date) {
      const result = await assignForDate(date);
      return res.status(201).json(result);
    } else {
      return res.status(400).json({ error: 'Missing date or date range (startDate/endDate)' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Schedule deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedules/bulk-delete', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Missing ids array' });
    }
    await prisma.schedule.deleteMany({
      where: { id: { in: ids } }
    });
    res.json({ message: 'Schedules deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedules/bulk-update', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ids, shiftId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !shiftId) {
      return res.status(400).json({ error: 'Missing ids or shiftId' });
    }
    await prisma.schedule.updateMany({
      where: { id: { in: ids } },
      data: { shiftId }
    });
    res.json({ message: 'Schedules updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. MAINTENANCE TIMETABLE ROUTES
// ==========================================

app.get('/api/maintenance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const maintenance = await prisma.maintenance.findMany({ orderBy: { startTime: 'desc' } });
    res.json(maintenance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maintenance', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, reason } = req.body;
    if (!startTime || !endTime) return res.status(400).json({ error: 'Start and end time are required' });

    const maintenance = await prisma.maintenance.create({
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        reason
      }
    });
    res.status(201).json(maintenance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/maintenance/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.maintenance.delete({ where: { id: req.params.id } });
    res.json({ message: 'Maintenance record deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. SYSTEM SETTINGS ROUTES
// ==========================================

app.get('/api/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const settingsObj = req.body; // Key-Value pair object
    for (const key of Object.keys(settingsObj)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(settingsObj[key]) },
        create: { key, value: String(settingsObj[key]) }
      });
    }
    res.json({ message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6B. BRANCH MANAGEMENT ROUTES
// ==========================================

app.get('/api/branches', authenticateToken, async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(branches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/branches', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, radius } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing branch name, latitude, or longitude' });
    }

    const crypto = require('crypto');
    const qrCodeKey = crypto.randomBytes(16).toString('hex');

    const branch = await prisma.branch.create({
      data: {
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: radius ? Number(radius) : 50,
        qrCodeKey
      }
    });
    res.json(branch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/branches/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, radius } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing branch name, latitude, or longitude' });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: radius ? Number(radius) : 50
      }
    });
    res.json(branch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/branches/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.branch.delete({
      where: { id }
    });
    res.json({ message: 'Branch deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. SECURE ATTENDANCE & SCAN MECHANICS
// ==========================================

// GET QR Token (Admin displays this on public dashboard)
app.get('/api/attendance/qr-token', authenticateToken, (req: Request, res: Response) => {
  const { branchId } = req.query;
  try {
    // Generate a temporary JWT token valid for 10 seconds, optionally containing branchId
    const token = jwt.sign({ 
      type: 'attendance_qr', 
      rand: Math.random(),
      ...(branchId ? { branchId } : {})
    }, QR_SECRET, { expiresIn: '10s' });
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Scan (Employee scans the QR from mobile app)
app.post('/api/attendance/scan', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const employeeId = req.user?.id;
  const employeeName = req.user?.name || 'Unknown Employee';
  const { qrToken, latitude, longitude, scanType } = req.body;

  try {
    if (!qrToken || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing qrToken, latitude, or longitude' });
    }

    // Helper to log failure
    const logFailure = async (reason: string) => {
      await prisma.scanFailure.create({
        data: { employeeId, employeeName, reason, latitude, longitude }
      });
      return res.status(400).json({ error: reason });
    };

    let isBranchScan = false;
    let branchId: string | null = null;
    let officeLat = 11.5564;
    let officeLon = 104.9282;
    let officeRadius = 50;
    let targetName = 'the office';

    // 1. Verify QR Token
    if (typeof qrToken === 'string' && qrToken.startsWith('BRANCH_QR:')) {
      const qrKey = qrToken.replace('BRANCH_QR:', '');
      const branch = await prisma.branch.findUnique({
        where: { qrCodeKey: qrKey }
      });

      if (!branch) {
        return await logFailure('Invalid Branch QR Code.');
      }

      // Check if employee is assigned to a branch, and if so, restrict scans to that branch only
      const empRecord = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (empRecord && empRecord.branchId && empRecord.branchId !== branch.id) {
        const assignedBranch = await prisma.branch.findUnique({ where: { id: empRecord.branchId } });
        return await logFailure(`អ្នកមិនត្រូវបានអនុញ្ញាតឱ្យចុះវត្តមាននៅសាខានេះទេ។ សាខាដែលបានកំណត់៖ ${assignedBranch?.name || 'ផ្សេងទៀត'} / You are not authorized to check in at this branch. Assigned branch: ${assignedBranch?.name || 'Other'}`);
      }

      isBranchScan = true;
      branchId = branch.id;
      officeLat = branch.latitude;
      officeLon = branch.longitude;
      officeRadius = branch.radius;
      targetName = branch.name;
    } else {
      let decoded: any;
      try {
        decoded = jwt.verify(qrToken, QR_SECRET);
      } catch (err) {
        return await logFailure('QR Code expired or invalid. Please scan again.');
      }

      if (decoded && decoded.branchId) {
        const branch = await prisma.branch.findUnique({
          where: { id: decoded.branchId }
        });
        if (branch) {
          // Check if employee is assigned to a branch
          const empRecord = await prisma.employee.findUnique({ where: { id: employeeId } });
          if (empRecord && empRecord.branchId && empRecord.branchId !== branch.id) {
            const assignedBranch = await prisma.branch.findUnique({ where: { id: empRecord.branchId } });
            return await logFailure(`អ្នកមិនត្រូវបានអនុញ្ញាតឱ្យចុះវត្តមាននៅសាខានេះទេ។ សាខាដែលបានកំណត់៖ ${assignedBranch?.name || 'ផ្សេងទៀត'} / You are not authorized to check in at this branch. Assigned branch: ${assignedBranch?.name || 'Other'}`);
          }

          isBranchScan = true;
          branchId = branch.id;
          officeLat = branch.latitude;
          officeLon = branch.longitude;
          officeRadius = branch.radius;
          targetName = branch.name;
        } else {
          return await logFailure('Branch associated with QR Code no longer exists.');
        }
      } else {
        // Dynamic General Office QR token: Restrict if employee has an assigned branch
        const empRecord = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (empRecord && empRecord.branchId) {
          const assignedBranch = await prisma.branch.findUnique({ where: { id: empRecord.branchId } });
          return await logFailure(`អ្នកមិនត្រូវបានអនុញ្ញាតឱ្យចុះវត្តមាននៅការិយាល័យកណ្តាលទេ។ សាខាដែលបានកំណត់៖ ${assignedBranch?.name || 'ផ្សេងទៀត'} / You are not authorized to check in at the general office. Assigned branch: ${assignedBranch?.name || 'Other'}`);
        }

        const latSetting = await prisma.systemSetting.findUnique({ where: { key: 'office_latitude' } });
        const lonSetting = await prisma.systemSetting.findUnique({ where: { key: 'office_longitude' } });
        const radSetting = await prisma.systemSetting.findUnique({ where: { key: 'office_radius' } });

        officeLat = latSetting ? Number(latSetting.value) : 11.5564;
        officeLon = lonSetting ? Number(lonSetting.value) : 104.9282;
        officeRadius = radSetting ? Number(radSetting.value) : 50;
      }
    }

    // 2. Check System Maintenance Mode
    const now = new Date();
    const maintenance = await prisma.maintenance.findFirst({
      where: {
        startTime: { lt: now },
        endTime: { gt: now }
      }
    });

    if (maintenance) {
      return await logFailure(`System is under maintenance: ${maintenance.reason || 'No reason specified'}`);
    }

    // 3. Verify Geofencing
    const distance = getDistanceInMeters(latitude, longitude, officeLat, officeLon);

    if (distance > officeRadius) {
      return await logFailure(
        `Geofencing verification failed. You are too far from ${targetName}. (Distance: ${Math.round(distance)}m, Allowed: ${officeRadius}m)`
      );
    }

    // 4. Determine Attendance Status & Timetable matching based on schedule
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const schedule = await prisma.schedule.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lt: todayEnd }
      },
      include: {
        shift: {
          include: {
            dayTimetables: {
              include: { timetable: true }
            }
          }
        }
      }
    });

    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const timetablesForToday = schedule
      ? schedule.shift.dayTimetables
          .filter((dt) => dt.dayOfWeek === dayOfWeek)
          .map((dt) => dt.timetable)
      : [];

    const timeStringToDate = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(now.getTime());
      d.setHours(h, m, 0, 0);
      return d;
    };

    let matchedTimetableForCheckIn: any = null;
    let matchedTimetableForCheckOut: any = null;

    for (const tt of timetablesForToday) {
      const startIn = timeStringToDate(tt.beginningIn);
      const endIn = timeStringToDate(tt.endingIn);
      const startOut = timeStringToDate(tt.beginningOut);
      const endOut = timeStringToDate(tt.endingOut);

      if (now >= startIn && now <= endIn) {
        matchedTimetableForCheckIn = tt;
      }
      if (now >= startOut && now <= endOut) {
        matchedTimetableForCheckOut = tt;
      }
    }

    // Explicit manual scanType logic overrides automatic timetable detection windows
    if (scanType === 'CHECK_OUT') {
      let activeAttForOut: any = null;
      let matchedTtName = '';

      if (matchedTimetableForCheckOut) {
        activeAttForOut = await prisma.attendance.findFirst({
          where: {
            employeeId,
            timetableId: matchedTimetableForCheckOut.id,
            checkIn: { gte: todayStart, lt: todayEnd },
            checkOut: null
          }
        });
        matchedTtName = matchedTimetableForCheckOut.name;
      }

      if (!activeAttForOut) {
        activeAttForOut = await prisma.attendance.findFirst({
          where: {
            employeeId,
            checkIn: { gte: todayStart, lt: todayEnd },
            checkOut: null
          },
          orderBy: { checkIn: 'desc' }
        });
      }

      if (activeAttForOut) {
        const updated = await prisma.attendance.update({
          where: { id: activeAttForOut.id },
          data: { checkOut: now }
        });
        return res.json({
          type: 'CHECK_OUT',
          message: matchedTtName 
            ? `Checked out successfully for ${matchedTtName}` 
            : 'Checked out successfully',
          attendance: updated,
          distance
        });
      } else {
        return res.status(400).json({ error: 'រកមិនឃើញទិន្នន័យ Check In សម្រាប់ថ្ងៃនេះទេ! / No active Check In found for today!' });
      }
    }

    if (scanType === 'CHECK_IN') {
      if (matchedTimetableForCheckIn) {
        const existingAtt = await prisma.attendance.findFirst({
          where: {
            employeeId,
            timetableId: matchedTimetableForCheckIn.id,
            checkIn: { gte: todayStart, lt: todayEnd }
          }
        });

        if (existingAtt) {
          return res.status(400).json({ error: 'អ្នកបានស្កែន Check In រួចរាល់ហើយសម្រាប់វេននេះ! / You have already checked in for this timetable today!' });
        }

        const dutyTime = timeStringToDate(matchedTimetableForCheckIn.onDutyTime);
        const diffMs = now.getTime() - dutyTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));

        let status: AttendanceStatus = AttendanceStatus.ON_TIME;
        let lateMinutes = 0;
        if (diffMinutes > matchedTimetableForCheckIn.lateTime) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }

        const attendance = await prisma.attendance.create({
          data: {
            employeeId: employeeId!,
            timetableId: matchedTimetableForCheckIn.id,
            latitude,
            longitude,
            distance,
            status,
            checkIn: now,
            branchId
          }
        });
        return res.json({
          type: 'CHECK_IN',
          message: status === AttendanceStatus.LATE 
            ? `Checked in successfully for ${matchedTimetableForCheckIn.name} (LATE by ${lateMinutes} mins)` 
            : `Checked in successfully for ${matchedTimetableForCheckIn.name} (ON TIME)`,
          attendance,
          distance
        });
      }

      // Fallback general check-in
      let status: AttendanceStatus = AttendanceStatus.ON_TIME;
      let lateMinutes = 0;
      let targetTimetableId: string | null = null;

      if (timetablesForToday.length > 0) {
        const alreadyAttendedIds = (await prisma.attendance.findMany({
          where: {
            employeeId,
            checkIn: { gte: todayStart, lt: todayEnd }
          },
          select: { timetableId: true }
        })).map(a => a.timetableId).filter(Boolean);

        const nextTimetable = timetablesForToday.find(t => !alreadyAttendedIds.includes(t.id)) || timetablesForToday[0];
        targetTimetableId = nextTimetable.id;

        const dutyTime = timeStringToDate(nextTimetable.onDutyTime);
        const diffMs = now.getTime() - dutyTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        if (diffMinutes > nextTimetable.lateTime) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }
      } else if (schedule) {
        const shift = schedule.shift;
        const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
        const shiftTime = new Date(now.getTime());
        shiftTime.setHours(shiftHour, shiftMin, 0, 0);

        const diffMs = now.getTime() - shiftTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        if (diffMinutes > shift.gracePeriod) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }
      }

      const attendance = await prisma.attendance.create({
        data: {
          employeeId: employeeId!,
          timetableId: targetTimetableId,
          latitude,
          longitude,
          distance,
          status,
          checkIn: now,
          branchId
        }
      });
      return res.json({
        type: 'CHECK_IN',
        message: status === AttendanceStatus.LATE
          ? `Checked in successfully (LATE by ${lateMinutes} mins)`
          : 'Checked in successfully (ON TIME)',
        attendance,
        distance
      });
    }

    if (matchedTimetableForCheckOut) {
      const activeAtt = await prisma.attendance.findFirst({
        where: {
          employeeId,
          timetableId: matchedTimetableForCheckOut.id,
          checkIn: { gte: todayStart, lt: todayEnd },
          checkOut: null
        }
      });

      if (activeAtt) {
        const updated = await prisma.attendance.update({
          where: { id: activeAtt.id },
          data: { checkOut: now }
        });
        return res.json({
          type: 'CHECK_OUT',
          message: `Checked out successfully for ${matchedTimetableForCheckOut.name}`,
          attendance: updated,
          distance
        });
      }
    }

    if (matchedTimetableForCheckIn) {
      const existingAtt = await prisma.attendance.findFirst({
        where: {
          employeeId,
          timetableId: matchedTimetableForCheckIn.id,
          checkIn: { gte: todayStart, lt: todayEnd }
        }
      });

      if (!existingAtt) {
        const dutyTime = timeStringToDate(matchedTimetableForCheckIn.onDutyTime);
        const diffMs = now.getTime() - dutyTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));

        let status: AttendanceStatus = AttendanceStatus.ON_TIME;
        let lateMinutes = 0;
        if (diffMinutes > matchedTimetableForCheckIn.lateTime) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }

        const attendance = await prisma.attendance.create({
          data: {
            employeeId: employeeId!,
            timetableId: matchedTimetableForCheckIn.id,
            latitude,
            longitude,
            distance,
            status,
            checkIn: now,
            branchId
          }
        });
        return res.json({
          type: 'CHECK_IN',
          message: status === AttendanceStatus.LATE 
            ? `Checked in successfully for ${matchedTimetableForCheckIn.name} (LATE by ${lateMinutes} mins)` 
            : `Checked in successfully for ${matchedTimetableForCheckIn.name} (ON TIME)`,
          attendance,
          distance
        });
      }
    }

    // 5. Fallback behavior (Single check-in/out range or general day tracking)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { gte: todayStart, lt: todayEnd },
        checkOut: null
      },
      orderBy: { checkIn: 'desc' }
    });

    if (activeAttendance) {
      const updated = await prisma.attendance.update({
        where: { id: activeAttendance.id },
        data: { checkOut: now }
      });
      return res.json({
        type: 'CHECK_OUT',
        message: 'Checked out successfully',
        attendance: updated,
        distance
      });
    } else {
      let status: AttendanceStatus = AttendanceStatus.ON_TIME;
      let lateMinutes = 0;
      let targetTimetableId: string | null = null;

      if (timetablesForToday.length > 0) {
        const alreadyAttendedIds = (await prisma.attendance.findMany({
          where: {
            employeeId,
            checkIn: { gte: todayStart, lt: todayEnd }
          },
          select: { timetableId: true }
        })).map(a => a.timetableId).filter(Boolean);

        const nextTimetable = timetablesForToday.find(t => !alreadyAttendedIds.includes(t.id)) || timetablesForToday[0];
        targetTimetableId = nextTimetable.id;

        const dutyTime = timeStringToDate(nextTimetable.onDutyTime);
        const diffMs = now.getTime() - dutyTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        if (diffMinutes > nextTimetable.lateTime) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }
      } else if (schedule) {
        const shift = schedule.shift;
        const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
        const shiftTime = new Date(now.getTime());
        shiftTime.setHours(shiftHour, shiftMin, 0, 0);

        const diffMs = now.getTime() - shiftTime.getTime();
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        if (diffMinutes > shift.gracePeriod) {
          status = AttendanceStatus.LATE;
          lateMinutes = diffMinutes;
        }
      }

      const attendance = await prisma.attendance.create({
        data: {
          employeeId: employeeId!,
          timetableId: targetTimetableId,
          latitude,
          longitude,
          distance,
          status,
          checkIn: now,
          branchId
        }
      });
      return res.json({
        type: 'CHECK_IN',
        message: status === AttendanceStatus.LATE 
          ? `Checked in successfully (LATE by ${lateMinutes} mins)` 
          : 'Checked in successfully (ON TIME)',
        attendance,
        distance
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const employeeId = req.user?.id;

    const query: any = {};
    if (role !== Role.ADMIN) {
      query.employeeId = employeeId;
    }

    const logs = await prisma.attendance.findMany({
      where: query,
      include: {
        employee: { select: { name: true, email: true, department: { select: { name: true } } } }
      },
      orderBy: { checkIn: 'desc' }
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/scan-failures', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const failures = await prisma.scanFailure.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(failures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset attendance data (to make testing easy)
app.post('/api/attendance/reset', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.attendance.deleteMany({});
    await prisma.scanFailure.deleteMany({});
    res.json({ message: 'Attendance records and logs reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. DASHBOARD & EXCEPTION REPORT ENGINE
// ==========================================

app.get('/api/attendance/dashboard-reports', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 1. Fetch Core Data
    const employees = await prisma.employee.findMany({ include: { department: true } });
    const schedules = await prisma.schedule.findMany({ include: { shift: true } });
    const attendances = await prisma.attendance.findMany({
      include: {
        employee: { select: { name: true, email: true, department: { select: { name: true } } } }
      }
    });
    const scanFailures = await prisma.scanFailure.findMany();

    // Auxiliary sets and maps
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // ------------------------------------------------------------------
    // TAB 1: Clock In/Out Log Exceptions
    // - Check-in exists but no check-out, and check-in date is in the past (yesterday or older)
    // ------------------------------------------------------------------
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const clockExceptions = attendances
      .filter(att => att.checkOut === null && new Date(att.checkIn) < todayStart)
      .map(att => ({
        id: att.id,
        employeeName: att.employee.name,
        departmentName: att.employee.department.name,
        checkIn: att.checkIn,
        type: 'Missing Check Out'
      }));

    // Helper to parse time string like "08:00" to minutes since midnight
    const parseTimeStr = (str: string) => {
      if (!str) return 0;
      const [h, m] = str.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // ------------------------------------------------------------------
    // TAB 2: Shift Exception (ABSENT, LATE, or EARLY_LEAVE on scheduled shifts)
    // ------------------------------------------------------------------
    const shiftExceptions: any[] = [];

    schedules.forEach(sched => {
      const emp = employeeMap.get(sched.employeeId);
      if (!emp) return;

      const schedDate = new Date(sched.date);
      const schedDateStr = schedDate.toDateString();

      // Find attendance for this employee on this date
      const attForDay = attendances.filter(att => {
        const attDate = new Date(att.checkIn);
        return att.employeeId === sched.employeeId && attDate.toDateString() === schedDateStr;
      });

      if (attForDay.length === 0) {
        // ABSENT (only log if the scheduled day is in the past)
        if (schedDate < todayStart) {
          shiftExceptions.push({
            id: `absent-${sched.id}`,
            employeeIdCode: emp.employeeIdCode || 'N/A',
            employeeName: emp.name,
            departmentName: emp.department.name,
            date: sched.date,
            timetable: sched.shift.name,
            onDuty: sched.shift.startTime,
            offDuty: sched.shift.endTime,
            clockIn: 'N/A',
            clockOut: 'N/A',
            late: '-',
            early: '-',
            absent: 'Yes',
            workTime: '-',
            type: 'ABSENT',
            details: `Scheduled for ${sched.shift.name} (${sched.shift.startTime} - ${sched.shift.endTime}) but did not scan.`
          });
        }
      } else {
        // Checked in, let's check for Late and Early checkout exceptions
        attForDay.forEach(att => {
          const checkInDate = new Date(att.checkIn);
          const khCheckIn = getCambodiaTime(checkInDate);
          const checkInMin = khCheckIn.getUTCHours() * 60 + khCheckIn.getUTCMinutes();
          const shiftStartMin = parseTimeStr(sched.shift.startTime);
          
          // Calculate late minutes (allow grace period)
          const rawLateMin = checkInMin - shiftStartMin;
          const lateMin = rawLateMin > sched.shift.gracePeriod ? rawLateMin : 0;
          const lateStr = lateMin > 0 ? `${lateMin} mins` : '-';

          // Calculate early minutes
          let earlyMin = 0;
          let clockOutStr = 'N/A';
          if (att.checkOut) {
            const checkOutDate = new Date(att.checkOut);
            const khCheckOut = getCambodiaTime(checkOutDate);
            const checkOutMin = khCheckOut.getUTCHours() * 60 + khCheckOut.getUTCMinutes();
            const shiftEndMin = parseTimeStr(sched.shift.endTime);
            earlyMin = Math.max(0, shiftEndMin - checkOutMin);
            clockOutStr = formatCambodiaTime(checkOutDate);
          }
          const earlyStr = earlyMin > 0 ? `${earlyMin} mins` : '-';

          // Check if there is an exception (either late or left early)
          const isLate = lateMin > 0 || att.status === AttendanceStatus.LATE;
          const isEarly = earlyMin > 0;

          if (isLate || isEarly) {
            let exceptionType = 'LATE';
            if (isLate && isEarly) exceptionType = 'LATE & EARLY';
            else if (isEarly) exceptionType = 'EARLY_LEAVE';

            let workTimeStr = '-';
            if (att.checkIn && att.checkOut) {
              const hours = (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60);
              workTimeStr = `${hours.toFixed(1)} hrs`;
            }

            shiftExceptions.push({
              id: `exception-${att.id}`,
              employeeIdCode: emp.employeeIdCode || 'N/A',
              employeeName: emp.name,
              departmentName: emp.department.name,
              date: att.checkIn,
              timetable: sched.shift.name,
              onDuty: sched.shift.startTime,
              offDuty: sched.shift.endTime,
              clockIn: formatCambodiaTime(checkInDate),
              clockOut: clockOutStr,
              late: lateStr,
              early: earlyStr,
              absent: 'No',
              workTime: workTimeStr,
              type: exceptionType,
              details: isLate && isEarly 
                ? `Late by ${lateMin}m and left early by ${earlyMin}m.` 
                : isLate 
                  ? `Arrived late at ${formatCambodiaTime(checkInDate)}.`
                  : `Left early at ${formatCambodiaTime(att.checkOut!)} (Shift end: ${sched.shift.endTime}).`
            });
          }
        });
      }
    });

    // ------------------------------------------------------------------
    // TAB 3: Misc Exception (Fails logs from ScanFailure)
    // ------------------------------------------------------------------
    const miscExceptions = scanFailures.map(fail => ({
      id: fail.id,
      employeeName: fail.employeeName || 'Unknown',
      date: fail.createdAt,
      type: 'Verification Failure',
      details: fail.reason,
      gps: `${fail.latitude.toFixed(4)}, ${fail.longitude.toFixed(4)}`
    }));

    // ------------------------------------------------------------------
    // TAB 4: Calculated Items (Summary aggregation per Employee)
    // ------------------------------------------------------------------
    const calculatedItems = employees.map(emp => {
      const empScheds = schedules.filter(s => s.employeeId === emp.id);
      const empAtts = attendances.filter(a => a.employeeId === emp.id);

      let lateCount = 0;
      let absentCount = 0;
      let onTimeCount = 0;
      let workedHours = 0;
      let overtimeHours = 0;

      // Count late / on time
      empAtts.forEach(att => {
        if (att.status === AttendanceStatus.LATE) lateCount++;
        if (att.status === AttendanceStatus.ON_TIME) onTimeCount++;

        // Work duration calculation
        if (att.checkIn && att.checkOut) {
          const hours = (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60);
          workedHours += hours;

          // Simple Overtime calculation: check if it exceeds 9 hours standard shift (including lunch)
          if (hours > 9) {
            overtimeHours += (hours - 9);
          }
        }
      });

      // Count absent (schedules in the past with no attendance)
      empScheds.forEach(sched => {
        const schedDate = new Date(sched.date);
        if (schedDate < todayStart) {
          const attended = empAtts.some(att => new Date(att.checkIn).toDateString() === schedDate.toDateString());
          if (!attended) absentCount++;
        }
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department.name,
        totalScheduled: empScheds.length,
        present: empAtts.length,
        onTime: onTimeCount,
        late: lateCount,
        absent: absentCount,
        hoursWorked: Number(workedHours.toFixed(1)),
        overtime: Number(overtimeHours.toFixed(1))
      };
    });

    // ------------------------------------------------------------------
    // TAB 5: OT Reports (Overtime specific logs)
    // ------------------------------------------------------------------
    const otReports: any[] = [];
    attendances.forEach(att => {
      if (att.checkIn && att.checkOut) {
        // Match with shift to calculate actual shift end difference
        const attDateStr = new Date(att.checkIn).toDateString();
        const sched = schedules.find(s => s.employeeId === att.employeeId && new Date(s.date).toDateString() === attDateStr);

        let otHours = 0;
        let shiftEndStr = 'N/A';

        if (sched) {
          const shift = sched.shift;
          shiftEndStr = shift.endTime;
          const [endHour, endMin] = shift.endTime.split(':').map(Number);
          const shiftEndTime = new Date(att.checkIn);
          shiftEndTime.setHours(endHour, endMin, 0, 0);

          const diffMs = new Date(att.checkOut).getTime() - shiftEndTime.getTime();
          if (diffMs > 0) {
            otHours = diffMs / (1000 * 60 * 60);
          }
        } else {
          // No shift scheduled, calculate everything after 8 hours as OT, or if worked > 0, count work hours - 8
          const hours = (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60);
          if (hours > 8) {
            otHours = hours - 8;
          }
        }

        if (otHours > 0.1) {
          const emp = employeeMap.get(att.employeeId);
          otReports.push({
            id: att.id,
            employeeName: emp?.name || 'Unknown',
            departmentName: emp?.department.name || 'Unknown',
            date: att.checkIn,
            checkIn: att.checkIn,
            checkOut: att.checkOut,
            shiftEnd: shiftEndStr,
            otHours: Number(otHours.toFixed(1)),
            details: `Checked out at ${formatCambodiaTime(att.checkOut)} (Shift ended at: ${shiftEndStr})`
          });
        }
      }
    });

    // ------------------------------------------------------------------
    // TAB 6: No Shift User Att (Scanned but had no scheduled shift)
    // ------------------------------------------------------------------
    const noShiftAtts = attendances
      .filter(att => {
        const attDateStr = new Date(att.checkIn).toDateString();
        const hasShift = schedules.some(s => s.employeeId === att.employeeId && new Date(s.date).toDateString() === attDateStr);
        return !hasShift;
      })
      .map(att => ({
        id: att.id,
        employeeName: att.employee.name,
        departmentName: att.employee.department.name,
        date: att.checkIn,
        checkIn: att.checkIn,
        checkOut: att.checkOut,
        distance: Math.round(att.distance)
      }));

    // ------------------------------------------------------------------
    // KPI METRICS
    // ------------------------------------------------------------------
    const totalEmployees = employees.length;
    const presentToday = attendances.filter(att => new Date(att.checkIn).toDateString() === todayStart.toDateString()).length;
    const activeShifts = await prisma.shift.count();
    const activeMaintenance = await prisma.maintenance.count({
      where: { endTime: { gte: new Date() } }
    });

    res.json({
      kpis: {
        totalEmployees,
        presentToday,
        activeShifts,
        activeMaintenance,
        verificationFailures: miscExceptions.length
      },
      reports: {
        clockExceptions,
        shiftExceptions,
        miscExceptions,
        calculatedItems,
        otReports,
        noShiftAtts
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve and listen
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend service listening at http://0.0.0.0:${port}`);
});
