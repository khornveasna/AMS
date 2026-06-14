import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Seed...');

  // Check if admin user already exists to prevent resetting user's test data
  const adminExists = await prisma.employee.findFirst({
    where: { email: 'superadmin@gmail.com' }
  });

  if (adminExists) {
    console.log('Database is already seeded. Skipping seed to preserve user-created departments and employees.');
    return;
  }

  // 1. Clear Existing Data
  await prisma.attendance.deleteMany({});
  await prisma.scanFailure.deleteMany({});
  await prisma.schedule.deleteMany({});
  await prisma.employeeMovement.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.shiftDayTimetable.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.maintenance.deleteMany({});
  await prisma.systemSetting.deleteMany({});

  // 2. Create Departments
  const hrDept = await prisma.department.create({ data: { name: 'Human Resources' } });
  const engDept = await prisma.department.create({ data: { name: 'Engineering' } });
  const mktDept = await prisma.department.create({ data: { name: 'Marketing' } });

  console.log('Departments created');

  // 3. Create Timetables
  const morningTimetable = await prisma.timetable.create({
    data: {
      name: 'Morning Block',
      onDutyTime: '08:00',
      offDutyTime: '12:00',
      beginningIn: '07:00',
      endingIn: '09:30',
      beginningOut: '11:00',
      endingOut: '13:00',
      lateTime: 15,
      leaveEarly: 15,
      workdayCount: 0.5,
      color: '#3b82f6',
      mustIn: true,
      mustOut: true
    }
  });

  const afternoonTimetable = await prisma.timetable.create({
    data: {
      name: 'Afternoon Block',
      onDutyTime: '13:00',
      offDutyTime: '17:00',
      beginningIn: '12:01',
      endingIn: '14:30',
      beginningOut: '16:00',
      endingOut: '18:30',
      lateTime: 15,
      leaveEarly: 15,
      workdayCount: 0.5,
      color: '#ef4444',
      mustIn: true,
      mustOut: true
    }
  });

  const fullDayTimetable = await prisma.timetable.create({
    data: {
      name: 'Full Day Block',
      onDutyTime: '08:00',
      offDutyTime: '17:00',
      beginningIn: '07:00',
      endingIn: '09:30',
      beginningOut: '16:00',
      endingOut: '18:30',
      lateTime: 15,
      leaveEarly: 15,
      workdayCount: 1.0,
      color: '#10b981',
      mustIn: true,
      mustOut: true
    }
  });

  console.log('Timetables created');

  // 4. Create Shifts
  const morningShift = await prisma.shift.create({
    data: { name: 'Office 4-Scan Shift', startTime: '08:00', endTime: '17:00', gracePeriod: 15 }
  });
  const nightShift = await prisma.shift.create({
    data: { name: 'Office 2-Scan Shift', startTime: '08:00', endTime: '17:00', gracePeriod: 15 }
  });

  // Assign timetables to shifts (Mon-Fri)
  for (let i = 1; i <= 5; i++) {
    await prisma.shiftDayTimetable.create({
      data: { shiftId: morningShift.id, dayOfWeek: i, timetableId: morningTimetable.id }
    });
    await prisma.shiftDayTimetable.create({
      data: { shiftId: morningShift.id, dayOfWeek: i, timetableId: afternoonTimetable.id }
    });

    await prisma.shiftDayTimetable.create({
      data: { shiftId: nightShift.id, dayOfWeek: i, timetableId: fullDayTimetable.id }
    });
  }

  console.log('Shifts and ShiftDayTimetable links created');

  // 4. Create Employees
  const hashedAdminPassword = await bcrypt.hash('Kvs@@15091993', 10);
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.employee.create({
    data: {
      name: 'Admin Manager',
      email: 'superadmin@gmail.com',
      password: hashedAdminPassword,
      role: Role.ADMIN,
      departmentId: hrDept.id,
      employeeIdCode: 'EMP-001',
      gender: 'Male',
      nationality: 'Khmer',
      phone: '012345678',
      jobTitle: 'HR Director',
      dob: '1985-05-15',
      dateOfEmployment: '2023-01-15'
    }
  });

  const dev1 = await prisma.employee.create({
    data: {
      name: 'Chan Leakhena',
      email: 'leakhena@ams.com',
      password: hashedPassword,
      role: Role.EMPLOYEE,
      departmentId: engDept.id,
      employeeIdCode: 'EMP-002',
      gender: 'Female',
      nationality: 'Khmer',
      phone: '098765432',
      jobTitle: 'Senior React Developer',
      dob: '1995-10-20',
      dateOfEmployment: '2024-06-01'
    }
  });

  const dev2 = await prisma.employee.create({
    data: {
      name: 'Sok Sophea',
      email: 'sophea@ams.com',
      password: hashedPassword,
      role: Role.EMPLOYEE,
      departmentId: engDept.id,
      employeeIdCode: 'EMP-003',
      gender: 'Male',
      nationality: 'Khmer',
      phone: '011223344',
      jobTitle: 'QA Engineer',
      dob: '1998-12-05',
      dateOfEmployment: '2025-02-10'
    }
  });

  console.log('Employees created');

  // 5. Create System Settings
  await prisma.systemSetting.createMany({
    data: [
      { key: 'office_latitude', value: '11.5564' },
      { key: 'office_longitude', value: '104.9282' },
      { key: 'office_radius', value: '50' }
    ]
  });

  console.log('System settings created');

  // 6. Create Maintenance Timetables (Past one, future one)
  await prisma.maintenance.create({
    data: {
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5), // 5 days ago
      endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5 + 2 * 60 * 60 * 1000), // 5 days ago + 2 hours
      reason: 'Database Engine Maintenance'
    }
  });

  console.log('Maintenance windows created');

  // 7. Create Schedules & Attendance History for testing
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);

  // Schedules
  // Yesterday schedules
  await prisma.schedule.create({ data: { employeeId: dev1.id, shiftId: morningShift.id, date: yesterday } });
  await prisma.schedule.create({ data: { employeeId: dev2.id, shiftId: morningShift.id, date: yesterday } });

  // Two days ago schedules
  await prisma.schedule.create({ data: { employeeId: dev1.id, shiftId: morningShift.id, date: twoDaysAgo } });
  await prisma.schedule.create({ data: { employeeId: dev2.id, shiftId: morningShift.id, date: twoDaysAgo } });

  // Today schedules
  await prisma.schedule.create({ data: { employeeId: dev1.id, shiftId: morningShift.id, date: today } });
  await prisma.schedule.create({ data: { employeeId: dev2.id, shiftId: morningShift.id, date: today } });

  console.log('Schedules created');

  // Attendance Records
  // Yesterday:
  // dev1 - On Time (Check-in 07:50 AM, Check-out 05:05 PM)
  const dev1CheckInYesterday = new Date(yesterday.getTime());
  dev1CheckInYesterday.setHours(7, 50, 0, 0);
  const dev1CheckOutYesterday = new Date(yesterday.getTime());
  dev1CheckOutYesterday.setHours(17, 5, 0, 0);

  await prisma.attendance.create({
    data: {
      employeeId: dev1.id,
      checkIn: dev1CheckInYesterday,
      checkOut: dev1CheckOutYesterday,
      latitude: 11.55641,
      longitude: 104.92821,
      distance: 2.1,
      status: AttendanceStatus.ON_TIME
    }
  });

  // dev2 - Late (Check-in 08:25 AM, Check-out 05:00 PM) - shift start 08:00, grace 15 mins (limit 08:15)
  const dev2CheckInYesterday = new Date(yesterday.getTime());
  dev2CheckInYesterday.setHours(8, 25, 0, 0);
  const dev2CheckOutYesterday = new Date(yesterday.getTime());
  dev2CheckOutYesterday.setHours(17, 0, 0, 0);

  await prisma.attendance.create({
    data: {
      employeeId: dev2.id,
      checkIn: dev2CheckInYesterday,
      checkOut: dev2CheckOutYesterday,
      latitude: 11.55642,
      longitude: 104.92822,
      distance: 3.5,
      status: AttendanceStatus.LATE
    }
  });

  // Two days ago:
  // dev1 - On Time (Check-in 07:55 AM, Check-out 05:10 PM)
  const dev1CheckInTwoDaysAgo = new Date(twoDaysAgo.getTime());
  dev1CheckInTwoDaysAgo.setHours(7, 55, 0, 0);
  const dev1CheckOutTwoDaysAgo = new Date(twoDaysAgo.getTime());
  dev1CheckOutTwoDaysAgo.setHours(17, 10, 0, 0);

  await prisma.attendance.create({
    data: {
      employeeId: dev1.id,
      checkIn: dev1CheckInTwoDaysAgo,
      checkOut: dev1CheckOutTwoDaysAgo,
      latitude: 11.55641,
      longitude: 104.92821,
      distance: 2.1,
      status: AttendanceStatus.ON_TIME
    }
  });

  // dev2 - ABSENT (two days ago has schedule but no attendance logs)

  // Add a ScanFailure log for testing exceptions
  const failureTime = new Date(yesterday.getTime());
  failureTime.setHours(8, 5, 0, 0);
  await prisma.scanFailure.create({
    data: {
      employeeId: dev2.id,
      employeeName: dev2.name,
      reason: 'Geofencing verification failed. You are too far from the office. (Distance: 1240m, Allowed: 50m)',
      latitude: 11.5623,
      longitude: 104.9150,
      createdAt: failureTime
    }
  });

  console.log('Attendance mock records seeded');
  console.log('DB Seed Finished Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
