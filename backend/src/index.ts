import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
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

function getCambodiaDateString(date: Date | string) {
  const kh = getCambodiaTime(date);
  const y = kh.getUTCFullYear();
  const m = (kh.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = kh.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeTimeTo24h(timeStr: string): string {
  if (!timeStr) return '';
  timeStr = timeStr.trim().toUpperCase();
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm in 24-hour format or with AM/PM.`);
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minutes in time: ${timeStr}`);
  }

  if (ampm) {
    if (hours < 1 || hours > 12) {
      throw new Error(`Invalid 12-hour format: ${timeStr}`);
    }
    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    }
    if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
  } else {
    if (hours < 0 || hours > 23) {
      throw new Error(`Invalid 24-hour format: ${timeStr}`);
    }
  }

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}

async function normalizeExistingTimetables() {
  try {
    const timetables = await prisma.timetable.findMany();
    for (const tt of timetables) {
      try {
        const normOnDuty = normalizeTimeTo24h(tt.onDutyTime);
        const normOffDuty = normalizeTimeTo24h(tt.offDutyTime);
        const normBeginningIn = normalizeTimeTo24h(tt.beginningIn);
        const normEndingIn = normalizeTimeTo24h(tt.endingIn);
        const normBeginningOut = normalizeTimeTo24h(tt.beginningOut);
        const normEndingOut = normalizeTimeTo24h(tt.endingOut);

        if (
          normOnDuty !== tt.onDutyTime ||
          normOffDuty !== tt.offDutyTime ||
          normBeginningIn !== tt.beginningIn ||
          normEndingIn !== tt.endingIn ||
          normBeginningOut !== tt.beginningOut ||
          normEndingOut !== tt.endingOut
        ) {
          await prisma.timetable.update({
            where: { id: tt.id },
            data: {
              onDutyTime: normOnDuty,
              offDutyTime: normOffDuty,
              beginningIn: normBeginningIn,
              endingIn: normEndingIn,
              beginningOut: normBeginningOut,
              endingOut: normEndingOut
            }
          });
          console.log(`Normalized timetable ${tt.name} to 24-hour format.`);
        }
      } catch (err: any) {
        console.error(`Failed to normalize timetable ${tt.name}: ${err.message}`);
      }
    }

    const shifts = await prisma.shift.findMany();
    for (const s of shifts) {
      try {
        const normStart = normalizeTimeTo24h(s.startTime);
        const normEnd = normalizeTimeTo24h(s.endTime);
        if (normStart !== s.startTime || normEnd !== s.endTime) {
          await prisma.shift.update({
            where: { id: s.id },
            data: {
              startTime: normStart,
              endTime: normEnd
            }
          });
          console.log(`Normalized shift ${s.name} to 24-hour format.`);
        }
      } catch (err: any) {
        console.error(`Failed to normalize shift ${s.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to load timetables/shifts for normalization: ${err.message}`);
  }
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

function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN || req.user?.email !== 'superadmin@gmail.com') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
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
      include: { 
        department: true, 
        branch: true,
        timetables: {
          select: { id: true }
        }
      },
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

    let targetDeptId = departmentId;
    if (role === 'ADMIN') {
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!targetDeptId) {
        const firstDept = await prisma.department.findFirst();
        if (firstDept) {
          targetDeptId = firstDept.id;
        } else {
          const newDept = await prisma.department.create({ data: { name: 'Administration' } });
          targetDeptId = newDept.id;
        }
      }
    } else {
      if (!name || !email || !password || !targetDeptId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
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
        departmentId: targetDeptId,
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

    const normOnDuty = normalizeTimeTo24h(onDutyTime);
    const normOffDuty = normalizeTimeTo24h(offDutyTime);
    const normBeginningIn = normalizeTimeTo24h(beginningIn || '07:00');
    const normEndingIn = normalizeTimeTo24h(endingIn || '09:30');
    const normBeginningOut = normalizeTimeTo24h(beginningOut || '11:00');
    const normEndingOut = normalizeTimeTo24h(endingOut || '13:00');

    const timetable = await prisma.timetable.create({
      data: {
        name,
        onDutyTime: normOnDuty,
        offDutyTime: normOffDuty,
        beginningIn: normBeginningIn,
        endingIn: normEndingIn,
        beginningOut: normBeginningOut,
        endingOut: normEndingOut,
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
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/timetables/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, onDutyTime, offDutyTime, beginningIn, endingIn, beginningOut, endingOut, lateTime, leaveEarly, workdayCount, color, mustIn, mustOut } = req.body;
    
    const normOnDuty = normalizeTimeTo24h(onDutyTime);
    const normOffDuty = normalizeTimeTo24h(offDutyTime);
    const normBeginningIn = normalizeTimeTo24h(beginningIn);
    const normEndingIn = normalizeTimeTo24h(endingIn);
    const normBeginningOut = normalizeTimeTo24h(beginningOut);
    const normEndingOut = normalizeTimeTo24h(endingOut);

    const timetable = await prisma.timetable.update({
      where: { id: req.params.id },
      data: {
        name,
        onDutyTime: normOnDuty,
        offDutyTime: normOffDuty,
        beginningIn: normBeginningIn,
        endingIn: normEndingIn,
        beginningOut: normBeginningOut,
        endingOut: normEndingOut,
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
    res.status(400).json({ error: err.message });
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
    const firstTimeStr = normalizeTimeTo24h(startTime || '08:00');
    const lastTimeStr = normalizeTimeTo24h(endTime || '17:00');

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
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/shifts/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, dayTimetables, startTime, endTime, gracePeriod } = req.body;
    const firstTimeStr = normalizeTimeTo24h(startTime || '08:00');
    const lastTimeStr = normalizeTimeTo24h(endTime || '17:00');

    const shift = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        name,
        startTime: firstTimeStr,
        endTime: lastTimeStr,
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
    res.status(400).json({ error: err.message });
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
          shiftId,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      });

      if (existing) {
        return existing;
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
// 4b. EMPLOYEE TIMETABLE ROUTES
// ==========================================

app.get('/api/employees/:id/timetables', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const employeeTimetables = await prisma.employeeTimetable.findMany({
      where: { employeeId: id },
      include: { timetable: true }
    });
    res.json(employeeTimetables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees/:id/timetables', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { timetableId, daysOfWeek } = req.body;

    if (!timetableId || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ error: 'Missing timetableId or daysOfWeek' });
    }

    const results = [];
    for (const day of daysOfWeek) {
      const existing = await prisma.employeeTimetable.findFirst({
        where: {
          employeeId: id,
          dayOfWeek: Number(day),
          timetableId
        }
      });

      if (!existing) {
        const record = await prisma.employeeTimetable.create({
          data: {
            employeeId: id,
            dayOfWeek: Number(day),
            timetableId
          }
        });
        results.push(record);
      }
    }

    res.status(201).json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id/timetables/:timetableId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, timetableId } = req.params;
    await prisma.employeeTimetable.deleteMany({
      where: {
        employeeId: id,
        timetableId
      }
    });
    res.json({ message: 'Timetable removed from employee successfully' });
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

app.get('/api/settings/public', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['company_name', 'company_logo']
        }
      }
    });
    const map: Record<string, string> = {
      company_name: 'AMS SYSTEM',
      company_logo: ''
    };
    settings.forEach(s => { map[s.key] = s.value; });
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
    const nowCambodiaStr = getCambodiaDateString(now);

    // Query schedules and check-ins within a 4-day sliding window to bypass timezone discrepancies,
    // and filter them strictly using getCambodiaDateString in memory.
    const windowStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const schedules = (await prisma.schedule.findMany({
      where: {
        employeeId,
        date: { gte: windowStart, lte: windowEnd }
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
    })).filter(sched => getCambodiaDateString(sched.date) === nowCambodiaStr);

    const getAttendancesForToday = async () => {
      const atts = await prisma.attendance.findMany({
        where: {
          employeeId,
          checkIn: { gte: windowStart, lte: windowEnd }
        }
      });
      return atts.filter(att => getCambodiaDateString(att.checkIn) === nowCambodiaStr);
    };

    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const employeeTimetablesForToday = await prisma.employeeTimetable.findMany({
      where: {
        employeeId,
        dayOfWeek
      },
      include: { timetable: true }
    });
    const timetablesForToday = employeeTimetablesForToday.map(et => et.timetable);

    if (schedules.length === 0) {
      return await logFailure('មិនទាន់មានកាលវិភាគការងារត្រូវបានកំណត់សម្រាប់អ្នកនៅថ្ងៃនេះទេ! សូមទាក់ទងផ្នែករដ្ឋបាល / No work schedule assigned to you for today! Please contact admin.');
    }

    if (timetablesForToday.length === 0) {
      return await logFailure('មិនមានម៉ោងការងារសម្រាប់អ្នកនៅថ្ងៃនេះទេ (ថ្ងៃសម្រាក/Off-day)! / No work hours scheduled for you today (Off-day)!');
    }

    const timeStringToDate = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const dateStr = `${nowCambodiaStr}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00+07:00`;
      return new Date(dateStr);
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

    // Check if employee is scanning too early for check-in
    let isPerformingCheckOut = scanType === 'CHECK_OUT';
    if (!isPerformingCheckOut && matchedTimetableForCheckOut) {
      const todayAtts = await getAttendancesForToday();
      const activeAtt = todayAtts.find(a => a.timetableId === matchedTimetableForCheckOut.id && a.checkOut === null);
      if (activeAtt) {
        isPerformingCheckOut = true;
      }
    }

    if (!isPerformingCheckOut && timetablesForToday.length > 0) {
      const todayAtts = await getAttendancesForToday();
      const alreadyCheckedInIds = todayAtts.map((a) => a.timetableId).filter(Boolean);

      const remainingTimetables = timetablesForToday
        .filter((tt) => !alreadyCheckedInIds.includes(tt.id))
        .sort((a, b) => a.beginningIn.localeCompare(b.beginningIn));

      if (remainingTimetables.length > 0) {
        const nextTt = remainingTimetables[0];
        const startIn = timeStringToDate(nextTt.beginningIn);

        if (now < startIn) {
          const diffMs = startIn.getTime() - now.getTime();
          const diffMinutes = Math.ceil(diffMs / (60 * 1000));
          return await logFailure(
            `មិនទាន់ដល់ម៉ោងស្កែនចូលសម្រាប់ ${nextTt.name} ទេ! នៅខ្វះរយៈពេល ${diffMinutes} នាទីទៀត / Not yet time to scan in for ${nextTt.name}! ${diffMinutes} minutes remaining.`
          );
        }
      }
    }

    // Explicit manual scanType logic strictly validating against defined timetable windows
    if (scanType === 'CHECK_OUT') {
      if (!matchedTimetableForCheckOut) {
        const allowedWindows = timetablesForToday.map(tt => `${tt.name}: ${tt.beginningOut}-${tt.endingOut}`).join(', ');
        return await logFailure(
          `មិនស្ថិតក្នុងម៉ោងអនុញ្ញាតឱ្យស្កែនចេញទេ! (ម៉ោងស្កែនចេញ៖ ${allowedWindows}) / Outside allowed check-out window! Allowed windows: ${allowedWindows}`
        );
      }

      const todayAtts = await getAttendancesForToday();
      const activeAttForOut = todayAtts.find(a => a.timetableId === matchedTimetableForCheckOut.id && a.checkOut === null);

      if (!activeAttForOut) {
        return await logFailure(
          `រកមិនឃើញទិន្នន័យ Check In សម្រាប់វេន ${matchedTimetableForCheckOut.name} ទេ! / No active Check In found for ${matchedTimetableForCheckOut.name}!`
        );
      }

      const updated = await prisma.attendance.update({
        where: { id: activeAttForOut.id },
        data: { checkOut: now }
      });
      return res.json({
        type: 'CHECK_OUT',
        message: `Checked out successfully for ${matchedTimetableForCheckOut.name}`,
        attendance: updated,
        distance
      });
    }

    if (scanType === 'CHECK_IN') {
      if (!matchedTimetableForCheckIn) {
        const allowedWindows = timetablesForToday.map(tt => `${tt.name}: ${tt.beginningIn}-${tt.endingIn}`).join(', ');
        return await logFailure(
          `មិនស្ថិតក្នុងម៉ោងអនុញ្ញាតឱ្យស្កែនចូលទេ! (ម៉ោងស្កែនចូល៖ ${allowedWindows}) / Outside allowed check-in window! Allowed windows: ${allowedWindows}`
        );
      }

      const todayAtts = await getAttendancesForToday();
      const existingAtt = todayAtts.find(a => a.timetableId === matchedTimetableForCheckIn.id);

      if (existingAtt) {
        return res.status(400).json({ error: `អ្នកបានស្កែន Check In រួចរាល់ហើយសម្រាប់វេន ${matchedTimetableForCheckIn.name}! / You have already checked in for ${matchedTimetableForCheckIn.name} today!` });
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

    return await logFailure('ប្រភេទស្កែនមិនត្រឹមត្រូវ (Invalid scanType)');
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

// POST /api/attendance/manual - Create an attendance record manually
app.post('/api/attendance/manual', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { employeeId, employeeIds, checkIn, checkOut, status, timetableId, branchId, latitude, longitude, distance } = req.body;
    if (!checkIn || !status) {
      return res.status(400).json({ error: 'Missing checkIn or status' });
    }

    if (employeeIds && Array.isArray(employeeIds)) {
      if (employeeIds.length === 0) {
        return res.status(400).json({ error: 'Please select at least one employee' });
      }
      const createdRecords = [];
      for (const empId of employeeIds) {
        const record = await prisma.attendance.create({
          data: {
            employeeId: empId,
            checkIn: new Date(checkIn),
            checkOut: checkOut ? new Date(checkOut) : null,
            status,
            timetableId: timetableId || null,
            branchId: branchId || null,
            latitude: latitude !== undefined ? parseFloat(latitude) : 0.0,
            longitude: longitude !== undefined ? parseFloat(longitude) : 0.0,
            distance: distance !== undefined ? parseFloat(distance) : 0.0
          }
        });
        createdRecords.push(record);
      }
      return res.status(201).json(createdRecords);
    }

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing employeeId' });
    }

    const record = await prisma.attendance.create({
      data: {
        employeeId,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : null,
        status,
        timetableId: timetableId || null,
        branchId: branchId || null,
        latitude: latitude !== undefined ? parseFloat(latitude) : 0.0,
        longitude: longitude !== undefined ? parseFloat(longitude) : 0.0,
        distance: distance !== undefined ? parseFloat(distance) : 0.0
      },
      include: {
        employee: { select: { name: true, email: true, department: { select: { name: true } } } }
      }
    });
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/:id - Update an existing attendance record
app.put('/api/attendance/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, timetableId, branchId, latitude, longitude, distance } = req.body;
    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }
    const record = await prisma.attendance.update({
      where: { id },
      data: {
        checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
        checkOut: checkOut !== undefined ? (checkOut ? new Date(checkOut) : null) : existing.checkOut,
        status: status || existing.status,
        timetableId: timetableId !== undefined ? (timetableId || null) : existing.timetableId,
        branchId: branchId !== undefined ? (branchId || null) : existing.branchId,
        latitude: latitude !== undefined ? parseFloat(latitude) : existing.latitude,
        longitude: longitude !== undefined ? parseFloat(longitude) : existing.longitude,
        distance: distance !== undefined ? parseFloat(distance) : existing.distance
      },
      include: {
        employee: { select: { name: true, email: true, department: { select: { name: true } } } }
      }
    });
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/attendance/:id - Delete an attendance record
app.delete('/api/attendance/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }
    await prisma.attendance.delete({ where: { id } });
    res.json({ message: 'Attendance record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. DASHBOARD & EXCEPTION REPORT ENGINE
// ==========================================

app.get('/api/attendance/dashboard-reports', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const kpisOnly = req.query.kpisOnly === 'true';
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (kpisOnly) {
      const totalEmployees = await prisma.employee.count();
      const presentToday = await prisma.attendance.count({
        where: {
          checkIn: {
            gte: todayStart
          }
        }
      });
      const activeShifts = await prisma.shift.count();
      const activeMaintenance = await prisma.maintenance.count({
        where: { endTime: { gte: new Date() } }
      });
      const verificationFailures = await prisma.scanFailure.count();

      return res.json({
        kpis: {
          totalEmployees,
          presentToday,
          activeShifts,
          activeMaintenance,
          verificationFailures
        },
        reports: {
          clockExceptions: [],
          shiftExceptions: [],
          miscExceptions: [],
          calculatedItems: [],
          otReports: [],
          noShiftAtts: []
        }
      });
    }

    // Support query filters from & to
    const fromDateStr = req.query.from as string | undefined;
    const toDateStr = req.query.to as string | undefined;

    let dateFilterSchedule: any = {};
    let dateFilterAttendance: any = {};
    let dateFilterScanFailure: any = {};

    if (fromDateStr || toDateStr) {
      if (fromDateStr) {
        const from = new Date(fromDateStr);
        dateFilterSchedule.gte = from;
        dateFilterAttendance.gte = from;
        dateFilterScanFailure.gte = from;
      }
      if (toDateStr) {
        const to = new Date(toDateStr);
        to.setHours(23, 59, 59, 999);
        dateFilterSchedule.lte = to;
        dateFilterAttendance.lte = to;
        dateFilterScanFailure.lte = to;
      }
    } else {
      // Default to last 60 days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      sixtyDaysAgo.setHours(0, 0, 0, 0);
      
      dateFilterSchedule.gte = sixtyDaysAgo;
      dateFilterAttendance.gte = sixtyDaysAgo;
      dateFilterScanFailure.gte = sixtyDaysAgo;
    }

    // 1. Fetch Core Data with range filters
    const employees = await prisma.employee.findMany({ include: { department: true } });
    const schedules = await prisma.schedule.findMany({
      where: {
        date: dateFilterSchedule
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
    const attendances = await prisma.attendance.findMany({
      where: {
        checkIn: dateFilterAttendance
      },
      include: {
        employee: { select: { name: true, email: true, department: { select: { name: true } } } },
        timetable: true
      }
    });
    const scanFailures = await prisma.scanFailure.findMany({
      where: {
        createdAt: dateFilterScanFailure
      }
    });

    // Auxiliary sets and maps
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // ------------------------------------------------------------------
    // TAB 1: Clock In/Out Log Exceptions
    // - Check-in exists but no check-out, and check-in date is in the past (yesterday or older)
    // ------------------------------------------------------------------


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
    // Fetch all employee timetables to match decoupled assignments
    const employeeTimetables = await prisma.employeeTimetable.findMany({
      include: { timetable: true }
    });

    // ------------------------------------------------------------------
    // TAB 2: Shift Exception (ABSENT, LATE, or EARLY_LEAVE on scheduled shifts)
    // ------------------------------------------------------------------
    const shiftExceptions: any[] = [];
    const processedKeys = new Set<string>();

    schedules.forEach(sched => {
      const emp = employeeMap.get(sched.employeeId);
      if (!emp) return;

      const schedDateStr = getCambodiaDateString(sched.date);
      const schedDate = new Date(schedDateStr + 'T00:00:00+07:00');
      const dayOfWeek = schedDate.getDay();

      // Find timetables for this day of week under this employee
      const dayTimetables = employeeTimetables.filter(et => et.employeeId === sched.employeeId && et.dayOfWeek === dayOfWeek);
      if (dayTimetables.length === 0) return; // Off day

      // Find attendance for this employee on this date
      const attForDay = attendances.filter(att => {
        return att.employeeId === sched.employeeId && getCambodiaDateString(att.checkIn) === schedDateStr;
      });

      dayTimetables.forEach(dt => {
        const tt = dt.timetable;
        const key = `${sched.employeeId}_${schedDateStr}_${tt.id}`;
        if (processedKeys.has(key)) return;
        processedKeys.add(key);

        let att = attForDay.find(a => a.timetableId === tt.id);

        if (!att) {
          // Fallback matching: if the attendance log has no timetableId (null), match by checking if it falls in the duty range
          att = attForDay.find(a => {
            const alreadyMatched = dayTimetables.some(otherDt => otherDt.timetable.id !== tt.id && a.timetableId === otherDt.timetable.id);
            if (alreadyMatched) return false;

            const checkInDate = new Date(a.checkIn);
            const khCheckIn = getCambodiaTime(checkInDate);
            const checkInMin = khCheckIn.getUTCHours() * 60 + khCheckIn.getUTCMinutes();
            
            const startInMin = parseTimeStr(tt.beginningIn);
            const endInMin = parseTimeStr(tt.endingIn);
            if (checkInMin >= startInMin && checkInMin <= endInMin) {
              return true;
            }

            const dutyMin = parseTimeStr(tt.onDutyTime);
            const offDutyMin = parseTimeStr(tt.offDutyTime);
            if (checkInMin >= dutyMin && checkInMin <= offDutyMin) {
              return true;
            }

            return false;
          });
        }

        if (!att) {
          // ABSENT for this timetable (only log if scheduled day/time has passed)
          if (schedDate < todayStart) {
            shiftExceptions.push({
              id: `absent-${sched.id}-${tt.id}`,
              employeeIdCode: emp.employeeIdCode || 'N/A',
              employeeName: emp.name,
              departmentName: emp.department.name,
              date: sched.date,
              timetable: `${tt.name} (${tt.onDutyTime} - ${tt.offDutyTime})`,
              onDuty: tt.onDutyTime,
              offDuty: tt.offDutyTime,
              clockIn: 'N/A',
              clockOut: 'N/A',
              late: '-',
              early: '-',
              absent: 'Yes',
              workTime: '-',
              type: 'ABSENT',
              details: `Scheduled for ${tt.name} (${tt.onDutyTime} - ${tt.offDutyTime}) but did not scan.`
            });
          }
        } else {
          // Checked in for this timetable, check for late/early leave
          const checkInDate = new Date(att.checkIn);
          const khCheckIn = getCambodiaTime(checkInDate);
          const checkInMin = khCheckIn.getUTCHours() * 60 + khCheckIn.getUTCMinutes();
          const shiftStartMin = parseTimeStr(tt.onDutyTime);

          const rawLateMin = checkInMin - shiftStartMin;
          const lateMin = rawLateMin > tt.lateTime ? rawLateMin : 0;
          const lateStr = lateMin > 0 ? `${lateMin}m` : '-';

          let earlyMin = 0;
          let clockOutStr = 'N/A';
          if (att.checkOut) {
            const checkOutDate = new Date(att.checkOut);
            const khCheckOut = getCambodiaTime(checkOutDate);
            const checkOutMin = khCheckOut.getUTCHours() * 60 + khCheckOut.getUTCMinutes();
            const shiftEndMin = parseTimeStr(tt.offDutyTime);
            const rawEarlyMin = Math.max(0, shiftEndMin - checkOutMin);
            earlyMin = rawEarlyMin > tt.leaveEarly ? rawEarlyMin : 0;
            clockOutStr = formatCambodiaTime(checkOutDate);
          }
          const earlyStr = earlyMin > 0 ? `${earlyMin}m` : '-';

          const isLate = lateMin > 0 || att.status === AttendanceStatus.LATE;
          const isEarly = earlyMin > 0;

          let exceptionType = 'ON TIME';
          if (isLate && isEarly) exceptionType = 'LATE & EARLY';
          else if (isLate) exceptionType = 'LATE';
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
            timetable: `${tt.name} (${tt.onDutyTime} - ${tt.offDutyTime})`,
            onDuty: tt.onDutyTime,
            offDuty: tt.offDutyTime,
            clockIn: formatCambodiaTime(checkInDate),
            clockOut: clockOutStr,
            late: lateStr,
            early: earlyStr,
            absent: 'No',
            workTime: workTimeStr,
            type: exceptionType,
            details: exceptionType === 'ON TIME'
              ? 'Checked in on time.'
              : isLate && isEarly
                ? `Late by ${lateMin}m and left early by ${earlyMin}m.`
                : isLate
                  ? `Arrived late by ${lateMin}m.`
                  : `Left early by ${earlyMin}m.`
          });
        }
      });
    });

    // Sort shiftExceptions by Date ascending, and by start time ascending for same date
    shiftExceptions.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return (a.onDuty || '').localeCompare(b.onDuty || '');
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

      // Count absent per scheduled timetable block (using Cambodia timezone)
      const processedCalKeys = new Set<string>();
      empScheds.forEach(sched => {
        const schedDateStr = getCambodiaDateString(sched.date);
        const schedDate = new Date(schedDateStr + 'T00:00:00+07:00');
        if (schedDate < todayStart) {
          const dayOfWeek = schedDate.getDay();
          const dayTimetables = employeeTimetables.filter(et => et.employeeId === emp.id && et.dayOfWeek === dayOfWeek);
          dayTimetables.forEach(dt => {
            const calKey = `${schedDateStr}_${dt.timetable.id}`;
            if (processedCalKeys.has(calKey)) return;
            processedCalKeys.add(calKey);

            const attended = empAtts.some(att => {
              const matchesTimetable = att.timetableId === dt.timetable.id;
              const matchesDay = getCambodiaDateString(att.checkIn) === schedDateStr;
              if (matchesTimetable && matchesDay) return true;

              // Fallback match for legacy/null timetable check-in
              if (!att.timetableId && matchesDay) {
                const checkInDate = new Date(att.checkIn);
                const khCheckIn = getCambodiaTime(checkInDate);
                const checkInMin = khCheckIn.getUTCHours() * 60 + khCheckIn.getUTCMinutes();
                const startInMin = parseTimeStr(dt.timetable.beginningIn);
                const endInMin = parseTimeStr(dt.timetable.endingIn);
                const dutyMin = parseTimeStr(dt.timetable.onDutyTime);
                const offDutyMin = parseTimeStr(dt.timetable.offDutyTime);
                if ((checkInMin >= startInMin && checkInMin <= endInMin) || (checkInMin >= dutyMin && checkInMin <= offDutyMin)) {
                  return true;
                }
              }
              return false;
            });
            if (!attended) absentCount++;
          });
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
        const attDateStr = getCambodiaDateString(att.checkIn);
        const sched = schedules.find(s => s.employeeId === att.employeeId && getCambodiaDateString(s.date) === attDateStr);

        let otHours = 0;
        let shiftEndStr = 'N/A';

        if (sched) {
          const shift = sched.shift;
          shiftEndStr = shift.endTime;
          const [endHour, endMin] = shift.endTime.split(':').map(Number);
          const dateStr = `${attDateStr}T${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00+07:00`;
          const shiftEndTimeKh = new Date(dateStr);

          const diffMs = new Date(att.checkOut).getTime() - shiftEndTimeKh.getTime();
          if (diffMs > 0) {
            otHours = diffMs / (1000 * 60 * 60);
          }
        } else {
          // No shift scheduled, calculate everything after 8 hours as OT
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
        const attDateStr = getCambodiaDateString(att.checkIn);
        const hasShift = schedules.some(s => s.employeeId === att.employeeId && getCambodiaDateString(s.date) === attDateStr);
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

    // Sort helper arrays by date ascending
    clockExceptions.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
    otReports.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    noShiftAtts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // ------------------------------------------------------------------
    // KPI METRICS
    // ------------------------------------------------------------------
    const totalEmployees = employees.length;
    const presentToday = attendances.filter(att => getCambodiaDateString(att.checkIn) === getCambodiaDateString(todayStart)).length;
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

// GET /api/admin/backup - Export DB JSON backup
app.get('/api/admin/backup', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany();
    const employees = await prisma.employee.findMany();
    const timetables = await prisma.timetable.findMany();
    const shifts = await prisma.shift.findMany();
    const shiftDayTimetables = await prisma.shiftDayTimetable.findMany();
    const employeeTimetables = await prisma.employeeTimetable.findMany();
    const schedules = await prisma.schedule.findMany();
    const attendances = await prisma.attendance.findMany();
    const branches = await prisma.branch.findMany();
    const maintenances = await prisma.maintenance.findMany();
    const systemSettings = await prisma.systemSetting.findMany();
    const scanFailures = await prisma.scanFailure.findMany();

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: {
        departments,
        employees,
        timetables,
        shifts,
        shiftDayTimetables,
        employeeTimetables,
        schedules,
        attendances,
        branches,
        maintenances,
        systemSettings,
        scanFailures
      }
    };

    // Also save a copy on the server so it appears in the backups list
    const BACKUP_DIR = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + '_' + 
      String(now.getHours()).padStart(2, '0') + '-' + 
      String(now.getMinutes()).padStart(2, '0') + '-' + 
      String(now.getSeconds()).padStart(2, '0');
    const filename = `ams_manual_backup_${dateStr}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

    res.setHeader('Content-disposition', `attachment; filename=ams_backup_${new Date().toISOString().slice(0,10)}.json`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(backupData, null, 2));
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate backup: ' + err.message });
  }
});

// POST /api/admin/restore - Restore DB from JSON backup
app.post('/api/admin/restore', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { version, data } = req.body;
    if (!version || !data) {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }

    // Wrap in a transaction to prevent partial restore on failure
    await prisma.$transaction(async (tx) => {
      // 1. Clear all existing tables
      await tx.attendance.deleteMany({});
      await tx.scanFailure.deleteMany({});
      await tx.schedule.deleteMany({});
      await tx.employeeMovement.deleteMany({});
      await tx.employeeTimetable.deleteMany({});
      await tx.employee.deleteMany({});
      await tx.department.deleteMany({});
      await tx.shiftDayTimetable.deleteMany({});
      await tx.timetable.deleteMany({});
      await tx.shift.deleteMany({});
      await tx.maintenance.deleteMany({});
      await tx.systemSetting.deleteMany({});
      await tx.branch.deleteMany({});

      // 2. Restore tables in dependency order
      // Departments
      if (data.departments?.length) {
        await tx.department.createMany({ data: data.departments });
      }
      // Branches
      if (data.branches?.length) {
        await tx.branch.createMany({ data: data.branches });
      }
      // Timetables
      if (data.timetables?.length) {
        await tx.timetable.createMany({ data: data.timetables });
      }
      // Shifts
      if (data.shifts?.length) {
        await tx.shift.createMany({ data: data.shifts });
      }
      // Shift Day Timetables
      if (data.shiftDayTimetables?.length) {
        await tx.shiftDayTimetable.createMany({ data: data.shiftDayTimetables });
      }
      // Employees
      if (data.employees?.length) {
        await tx.employee.createMany({ data: data.employees });
      }
      // Employee Timetables
      if (data.employeeTimetables?.length) {
        await tx.employeeTimetable.createMany({ data: data.employeeTimetables });
      }
      // Schedules
      if (data.schedules?.length) {
        const mappedSchedules = data.schedules.map((s: any) => ({
          ...s,
          date: new Date(s.date)
        }));
        await tx.schedule.createMany({ data: mappedSchedules });
      }
      // Attendances
      if (data.attendances?.length) {
        const mappedAttendances = data.attendances.map((a: any) => ({
          ...a,
          checkIn: new Date(a.checkIn),
          checkOut: a.checkOut ? new Date(a.checkOut) : null
        }));
        await tx.attendance.createMany({ data: mappedAttendances });
      }
      // Maintenances
      if (data.maintenances?.length) {
        const mappedMaintenances = data.maintenances.map((m: any) => ({
          ...m,
          startTime: new Date(m.startTime),
          endTime: new Date(m.endTime)
        }));
        await tx.maintenance.createMany({ data: mappedMaintenances });
      }
      // System Settings
      if (data.systemSettings?.length) {
        await tx.systemSetting.createMany({ data: data.systemSettings });
      }
      // Scan Failures
      if (data.scanFailures?.length) {
        const mappedScanFailures = data.scanFailures.map((sf: any) => ({
          ...sf,
          createdAt: new Date(sf.createdAt)
        }));
        await tx.scanFailure.createMany({ data: mappedScanFailures });
      }
    });

    res.json({ message: 'Database restored successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

// ==========================================
// AUTO BACKUP SCHEDULER & MANAGEMENT ROUTES
// ==========================================

const BACKUP_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Function to generate the auto backup
async function runAutoBackup() {
  try {
    const departments = await prisma.department.findMany();
    const employees = await prisma.employee.findMany();
    const timetables = await prisma.timetable.findMany();
    const shifts = await prisma.shift.findMany();
    const shiftDayTimetables = await prisma.shiftDayTimetable.findMany();
    const employeeTimetables = await prisma.employeeTimetable.findMany();
    const schedules = await prisma.schedule.findMany();
    const attendances = await prisma.attendance.findMany();
    const branches = await prisma.branch.findMany();
    const maintenances = await prisma.maintenance.findMany();
    const systemSettings = await prisma.systemSetting.findMany();
    const scanFailures = await prisma.scanFailure.findMany();

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: {
        departments,
        employees,
        timetables,
        shifts,
        shiftDayTimetables,
        employeeTimetables,
        schedules,
        attendances,
        branches,
        maintenances,
        systemSettings,
        scanFailures
      }
    };

    const now = new Date();
    // Format: YYYY-MM-DD_HH-MM-SS
    const dateStr = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + '_' + 
      String(now.getHours()).padStart(2, '0') + '-' + 
      String(now.getMinutes()).padStart(2, '0') + '-' + 
      String(now.getSeconds()).padStart(2, '0');

    const filename = `ams_auto_backup_${dateStr}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`[Auto Backup] Successfully saved auto-backup file: ${filename}`);
  } catch (err: any) {
    console.error(`[Auto Backup Error] Failed: ${err.message}`);
  }
}

// Schedule Cron Job: run every day at 18:00 (6:00 PM)
// Pattern: '0 18 * * *'
cron.schedule('0 18 * * *', () => {
  console.log('[Scheduler] Triggering auto backup at 18:00...');
  runAutoBackup();
});

// GET /api/admin/backups/list - List all auto backups stored on server
app.get('/api/admin/backups/list', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // newest first

    res.json(backupFiles);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list backups: ' + err.message });
  }
});

// GET /api/admin/backups/download/:filename - Download a specific backup file from server
app.get('/api/admin/backups/download/:filename', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file name.' });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found.' });
    }
    res.download(filepath);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to download backup: ' + err.message });
  }
});

// POST /api/admin/backups/restore/:filename - Restore database from a specific auto backup file
app.post('/api/admin/backups/restore/:filename', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file name.' });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const { version, data } = JSON.parse(fileContent);
    if (!version || !data) {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }

    // Wrap in a transaction to prevent partial restore on failure
    await prisma.$transaction(async (tx) => {
      // 1. Clear all existing tables
      await tx.attendance.deleteMany({});
      await tx.scanFailure.deleteMany({});
      await tx.schedule.deleteMany({});
      await tx.employeeMovement.deleteMany({});
      await tx.employeeTimetable.deleteMany({});
      await tx.employee.deleteMany({});
      await tx.department.deleteMany({});
      await tx.shiftDayTimetable.deleteMany({});
      await tx.timetable.deleteMany({});
      await tx.shift.deleteMany({});
      await tx.maintenance.deleteMany({});
      await tx.systemSetting.deleteMany({});
      await tx.branch.deleteMany({});

      // 2. Restore tables in dependency order
      if (data.departments?.length) await tx.department.createMany({ data: data.departments });
      if (data.branches?.length) await tx.branch.createMany({ data: data.branches });
      if (data.timetables?.length) await tx.timetable.createMany({ data: data.timetables });
      if (data.shifts?.length) await tx.shift.createMany({ data: data.shifts });
      if (data.shiftDayTimetables?.length) await tx.shiftDayTimetable.createMany({ data: data.shiftDayTimetables });
      if (data.employees?.length) await tx.employee.createMany({ data: data.employees });
      if (data.employeeTimetables?.length) await tx.employeeTimetable.createMany({ data: data.employeeTimetables });
      if (data.schedules?.length) {
        await tx.schedule.createMany({ data: data.schedules.map((s: any) => ({ ...s, date: new Date(s.date) })) });
      }
      if (data.attendances?.length) {
        await tx.attendance.createMany({ data: data.attendances.map((a: any) => ({ ...a, checkIn: new Date(a.checkIn), checkOut: a.checkOut ? new Date(a.checkOut) : null })) });
      }
      if (data.maintenances?.length) {
        await tx.maintenance.createMany({ data: data.maintenances.map((m: any) => ({ ...m, startTime: new Date(m.startTime), endTime: new Date(m.endTime) })) });
      }
      if (data.systemSettings?.length) await tx.systemSetting.createMany({ data: data.systemSettings });
      if (data.scanFailures?.length) {
        await tx.scanFailure.createMany({ data: data.scanFailures.map((sf: any) => ({ ...sf, createdAt: new Date(sf.createdAt) })) });
      }
    });

    res.json({ message: 'Database restored successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore: ' + err.message });
  }
});

// DELETE /api/admin/backups/delete/:filename - Delete a specific backup file
app.delete('/api/admin/backups/delete/:filename', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file name.' });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found.' });
    }
    fs.unlinkSync(filepath);
    res.json({ message: 'Backup file deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message });
  }
});

// Serve and listen
app.listen(port, '0.0.0.0', async () => {
  console.log(`Backend service listening at http://0.0.0.0:${port}`);
  await normalizeExistingTimetables();
});
