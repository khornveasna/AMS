# Attendance Management System (Enterprise-Level)
## System Architecture & Specification Document

ឯកសារនេះរៀបរាប់ពី រចនាសម្ព័ន្ធបច្ចេកវិទ្យា មុខងារលម្អិត និងការរៀបចំប្រព័ន្ធគ្រប់គ្រងវត្តមានកម្រិតខ្ពស់ ដែលប្រើប្រាស់បច្ចេកវិទ្យា Modern Web Stack។

---

## ១. រចនាសម្ព័ន្ធបច្ចេកវិទ្យា (The Tech Stack)

ប្រព័ន្ធនេះត្រូវបានបែងចែកជា ៣ ផ្នែកធំៗ (3-Tier Architecture)៖

### តារាងបច្ចេកវិទ្យា និងបណ្ណាល័យចម្បង (Tech Stack & Dependencies)

| ផ្នែក (Area) | បច្ចេកវិទ្យា/បណ្ណាល័យ (Tech/Library) | កំណែទម្រង់ (Version) | តួនាទីក្នុងប្រព័ន្ធ (Role/Function) |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React | `^19.2.6` | បង្កើតទម្រង់ UI (User Interface) ជាប្រភេទ SPA (Single Page App) |
| **Routing** | React Router DOM | `^7.15.1` | គ្រប់គ្រងការផ្លាស់ប្តូរទំព័រ (Navigation) លើ Client |
| **Styling** | Tailwind CSS & @tailwindcss/vite | `^4.3.0` | ឌីហ្សាញ និងរចនា UI ឱ្យមានភាពទាក់ទាញ និង responsive |
| **Mobile Integration** | Capacitor (Core, Cli, Android, iOS) | `^8.4.0` *(ធ្វើពេលក្រោយ)* | បំប្លែង React Web App ទៅជា Native App លើ Android & iOS |
| **Backend Core** | Express.js | `^5.2.1` | បង្កើត RESTful API Endpoint សម្រាប់ទំនាក់ទំនង Client-Server |
| **Database Driver** | PostgreSQL (pg) | `^8.11.3` | តភ្ជាប់ និងគ្រប់គ្រងការ Query ទៅកាន់ Database Server |
| **Security/Auth** | JSON Web Token (jsonwebtoken) & bcrypt | `^9.0.3` / `^6.0.0` | បង្កើត Token សុវត្ថិភាពសម្រាប់ការ Login និងការ Hash password |
| **Build Tool** | Vite | `^8.0.12` | ជំនួយការ Build កូដ និង Run development server រហ័ស |

### ផ្នែកខាងមុខ (Frontend)
* **Framework:** React (Vite) - ធានាល្បឿនលឿន និងបង្កើនប្រសិទ្ធភាពការងារ។
* **Language:** TypeScript - ធានាភាពត្រឹមត្រូវនៃប្រភេទដទិន្នន័យ (Type-safe)។
* **UI Library:** HeroUI (v3) - ប្រើប្រាស់សម្រាប់បង្កើតសមាសភាគ (Components) ទំនើបៗ និងស្អាត។
* **Styling:** Tailwind CSS - ជំនួយដល់ការរចនា និងធ្វើឱ្យ UI បត់បែនតាមទូរស័ព្ទ (Responsive)។
* **Data Fetching:** TanStack Query (React Query) - គ្រប់គ្រង Server State និង Caching។

### ផ្នែកខាងក្រោយ (Backend)
* **Runtime:** Node.js
* **Framework:** Express.js (TypeScript) - បង្កើត RESTful API ដែលស្រាល និងរហ័ស។
* **ORM:** Prisma ORM - ជាស្ពានទំនាក់ទំនង និងគ្រប់គ្រង Database យ៉ាងមានសុវត្ថិភាព។
* **Authentication:** JSON Web Token (JWT) - ផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រើប្រាស់។

### មូលដ្ឋានទិន្នន័យ (Database)
* **Database:** PostgreSQL - មូលដ្ឋានទិន្នន័យប្រភេទ Relational រឹងមាំ ស័ក្តិសមសម្រាប់ទិន្នន័យដែលមានទំនាក់ទំនងស្មុគស្មាញ។

---

## ២. មុខងារស្នូលរបស់ប្រព័ន្ធ (Core System Features)

### ក. ការគ្រប់គ្រងស្ថាប័ន (Organization Management)
* **Department Management:** បង្កើត, កែប្រែ, និងលុប ផ្នែក/ដេប៉ាតាម៉ង់។
* **Employee Management:** បង្កើតគណនីបុគ្គលិក ភ្ជាប់ទៅកាន់ផ្នែក និងរក្សាទុកប្រវត្តិពេលប្តូរផ្នែក (Employee Movement)។

### ខ. ការគ្រប់គ្រងកាលវិភាគ និងពេលវេលា (Scheduling & Shift Management)
* **Shifts Management:** កំណត់ម៉ោងចូល-ចេញ (ឧទាហរណ៍៖ 8:00 AM - 5:00 PM) និងកំណត់ម៉ោងអនុញ្ញាតឱ្យ Scan (Grace Period)។
* **Employee Schedule:** ចាត់ចែងកាលវិភាគការងាររបស់បុគ្គលិកម្នាក់ៗ ឬតាមផ្នែកនៅលើប្រតិទិន។
* **Maintenance Timetable:** កំណត់ម៉ោងបិទប្រព័ន្ធបណ្តោះអាសន្នដើម្បី Update ដោយមិនឱ្យមានការ Scan ឡើយ។

### គ. ប្រព័ន្ធចុះវត្តមាន សុវត្ថិភាពខ្ពស់ (Secure Attendance Mechanics)
* **Dynamic QR Code:** បង្កើត QR Code នៅលើអេក្រង់ក្រុមហ៊ុន ដែលផ្លាស់ប្តូរ Token រាល់ ៥ ទៅ ១០ វិនាទីម្តង ការពារការលួចថតរូប Scan ពីចម្ងាយ។
* **GPS Geofencing:** នៅពេលបុគ្គលិក Scan វត្តមាន ប្រព័ន្ធនឹងទាញយកទីតាំង GPS (Latitude, Longitude) ពីទូរស័ព្ទ រួចគណនាចម្ងាយធៀបនឹងក្រុមហ៊ុន (ឧទាហរណ៍៖ អនុញ្ញាតក្នុងរង្វង់ ៥០ ម៉ែត្រ)។

### ឃ. របាយការណ៍ និងការគណនា (Report & Calculation Dashboard)
* **Calculate Engine:** គណនាម៉ោង Scan ធៀបនឹងវេនការងារ ដើម្បីចេញលទ្ធផល៖ មកទាន់ពេល (On Time), មកយឺត (Late), ឬអវត្តមាន (Absent)។
* **HeroUI Dashboard View:** បំប្លែង Tabs របាយការណ៍ចាស់ មកជាទម្រង់ Web ដែលមាន Tabs ដូចជា៖
    * Clock In/Out Log Exceptions
    * Shift Exception
    * Misc Exception
    * Calculated items
    * OT Reports
    * No Shift User Att
* **Export Data:** មុខងារទាញយកទិន្នន័យចេញជាទម្រង់ Excel (.xlsx) ឬ PDF។

---

## ៣. គំរូទិន្នន័យ (Prisma Data Model)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  EMPLOYEE
}

enum AttendanceStatus {
  ON_TIME
  LATE
  ABSENT
}

model Department {
  id        String     @id @default(uuid())
  name      String     @unique
  employees Employee[]
  createdAt DateTime   @default(now())
}

model Employee {
  id           String       @id @default(uuid())
  name         String
  email        String       @unique
  password     String
  role         Role         @default(EMPLOYEE)
  departmentId String
  department   Department   @relation(fields: [departmentId], references: [id])
  schedules    Schedule[]
  attendances  Attendance[]
  createdAt    DateTime     @default(now())
}

model Shift {
  id         String     @id @default(uuid())
  name       String     // ឧទាហរណ៍៖ "Morning Shift"
  startTime  String     // "08:00"
  endTime    String     // "17:00"
  schedules  Schedule[]
}

model Schedule {
  id         String   @id @default(uuid())
  employeeId String
  shiftId    String
  date       DateTime // ថ្ងៃខែឆ្នាំដែលត្រូវធ្វើការ
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  shift      Shift    @relation(fields: [shiftId], references: [id], onDelete: Cascade)
}

model Attendance {
  id         String           @id @default(uuid())
  employeeId String
  checkIn    DateTime         @default(now())
  checkOut   DateTime?
  latitude   Float            // ទីតាំងជាក់ស្តែងពេល Scan
  longitude  Float            // ទីតាំងជាក់ស្តែងពេល Scan
  status     AttendanceStatus @default(ON_TIME)
  employee   Employee         @relation(fields: [employeeId], references: [id], onDelete: Cascade)
}

model Maintenance {
  id        String   @id @default(uuid())
  startTime DateTime
  endTime   DateTime
  reason    String?
}