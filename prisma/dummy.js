// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?
// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init

generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "mongodb"
    url = env("DATABASE_URL")
}

model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  email     String   @unique
  password  String
  role      Role     // Defines user roles
  activities UserActivity[]
  schoolMember SchoolMember?
  student     Student? @relation("User", fields: [studentId], references: [id])
  studentId   String?
}

enum Role {
  SUPERADMIN        // Manages all users, IT administration, system management
  RESEARCH_ADMIN    // Same as SuperAdmin but without form editing access
  SCHOOL_ADMIN      // Manages students from the proposal submission stage onwards
  DEAN             // School Dean with school admin privileges
  SCHOOL_PA        // Personal Assistant with school admin privileges
  STUDENT          // Views details, accepts dates, and sees notifications
}

model UserActivity {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  userId      String
  action      String   // e.g., "Updated Proposal Status", "Assigned Supervisor"
  entityType  String   // e.g., "Proposal", "Student", "Viva"
  entityId    String   // ID of the affected entity
  timestamp   DateTime @default(now())
}

model Student {
  id                    String         @id @default(auto()) @map("_id") @db.ObjectId
  name                  String
  email                 String         @unique
  admissionDate        DateTime       @default(now())
  expectedCompletionDate DateTime?
  totalDuration        Int?           // Total duration in days since admission
  
  // Relations
 // currentBook          Book?          @relation("CurrentBook",fields: [currentBookId], references: [id], onDelete: Cascade)
  //currentBookId        String?        @db.ObjectId
  //currentProposal      Proposal?      @relation("CurrentProposal", fields: [currentProposalId], references: [id])
  //currentProposalId    String?        @db.ObjectId
  //currentStatus        StudentStatus? @relation("CurrentStatus", fields: [currentStatusId], references: [id])
  //currentStatusId      String?        @db.ObjectId
  supervisor           Supervisor?    @relation(fields: [supervisorId], references: [id])
  supervisorId         String?         @db.ObjectId
  //fieldWork            FieldWork?     @relation("FieldWork", fields: [fieldWorkId], references: [id])
  //fieldWorkId          String?         @db.ObjectId
  //viva                 Viva?          @relation("Viva", fields: [vivaId], references: [id])
  //vivaId               String?        @db.ObjectId
  user                 User?           @relation("User")
  userId               String?         @db.ObjectId

  // Arrays
  statuses             StudentStatus[] @relation("StudentStatus")
  proposals            Proposal[]      @relation("Proposals")
  notifications        Notification[]  @relation("Notifications") 
  supervisors          Supervisor[]  @relation("Supervisors")
  books                Book[]          @relation("Books")
  vivas                 Viva[]       
}

model StatusDefinition {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String   @unique  // e.g., "BREAK", "WORKSHOP", etc.
  description     String
  expectedDuration Int     // Expected duration in days
  warningDays     Int     // Days before expected end to send warning
  criticalDays    Int     // Days after expected end to send critical notification
  notifyRoles     Role[]  // Which roles to notify
  isActive        Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  studentStatuses StudentStatus[] // All student statuses using this definition
}

model StudentStatus {
  id                String           @id @default(auto()) @map("_id") @db.ObjectId
  student           Student?         @relation("CurrentStatus")
  studentId         String?          @db.ObjectId
  definition        StatusDefinition @relation(fields: [definitionId], references: [id])
  definitionId      String
  startDate         DateTime         @default(now())
  endDate           DateTime?
  duration          Int?             // Actual duration in days
  conditions        String?          // Conditions or remarks
  isActive          Boolean          @default(true)
  notificationsSent NotificationLog[] // Track which notifications were sent
  currentForStudent Student?         @relation("CurrentForStudent")
}

model NotificationLog {
  id            String          @id @default(auto()) @map("_id") @db.ObjectId
  studentStatus StudentStatus   @relation(fields: [statusId], references: [id])
  statusId      String
  type          NotificationType
  sentAt        DateTime        @default(now())
  recipients    String[]        // List of email addresses notified
  message       String
}

enum NotificationType {
  WARNING    // Approaching deadline
  CRITICAL   // Past deadline
  INFO       // General information
}

model Proposal {
  id          String            @id @default(auto()) @map("_id") @db.ObjectId
  isCurrent   Boolean          @default(false)
  student     Student          @relation("Proposals", fields: [studentId], references: [id])
  studentId   String           @db.ObjectId
  reviewers   ProposalReviewer[] @relation("ProposalReviewers")
  status      String           // Pending Review, Reviewed, Defended, Graded-Passed, Graded-Failed
  submittedAt DateTime         @default(now())
  defenseDate DateTime?
  panelists   String[]
  comments    String?
  markRange   Int?
}

model Book {
  id                           String    @id @default(auto()) @map("_id") @db.ObjectId
  student                      Student?   @relation(fields: [studentId], references: [id])
  studentId                    String?    @db.ObjectId
  submittedAt                  DateTime  @default(now())
  externalSubmissionDate       DateTime?
  internalSubmissionDate       DateTime?
  externalReportSubmissionDate DateTime?
  internalReportSubmissionDate DateTime?
  isCurrent                    Boolean   @default(false)
  submissionCondition         String    // Normal or Resubmission
  researchAdminUpdated        Boolean   @default(false)
  externalExaminer            Examiner? @relation("ExternalExaminer", fields: [externalExaminerId], references: [id])
  externalExaminerId          String?   @db.ObjectId
  internalExaminer            Examiner? @relation("InternalExaminer", fields: [internalExaminerId], references: [id])
  internalExaminerId          String?   @db.ObjectId
  externalMarks               Int?
  internalMarks               Int?
  finalGrade                  Float?    // Average of external and internal marks
  status                      String    // Under Examination, Passed, Failed, Resubmission Required
}

model Examiner {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  email       String    @unique
  type        String    // Internal or External
  submittedAt DateTime?
  books       Book[]    @relation("ExaminerBooks")
}

model Supervisor {
  id       String    @id @default(auto()) @map("_id") @db.ObjectId
  name     String
  email    String    @unique
  students Student[]
}

model FieldWork {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  student        Student  @relation("FieldWork", fields: [studentId], references: [id])
  studentId      String   @db.ObjectId
  status         String   // Ongoing, Completed
  startDate      DateTime
  endDate        DateTime?
  letterReceived Boolean  @default(false)
}

model Reviewer {
  id        String             @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  email     String             @unique
  proposals ProposalReviewer[] @relation("ReviewerProposals")
}

model Viva {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  student      Student  @relation("Student", fields: [studentId], references: [id])
  studentId    String?
  scheduledAt  DateTime
  status       String  // Pending, Passed, Failed
  panelists    String[]
  verdict      String?
  minutesPending Boolean @default(true)
}

model Notification {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  recipient String   // Student or Admin Email
  message   String
  createdAt DateTime @default(now())
  sent      Boolean @default(false)
  student     Student  @relation("Notifications", fields: [studentId], references: [id])
  studentId   String
}

model School {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  code        String   @unique
  url         String?
  branch      String
  members     SchoolMember[]
  departments Department[]
}

model SchoolMember {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  school    School   @relation(fields: [schoolId], references: [id])
  schoolId  String
  name      String
  contact   String
  email     String @unique
  role      String // Dean, Personal Assistant, School Admin
  user      User?    @relation(fields: [userId], references: [id])
  userId    String?  @db.ObjectId
}

model Department {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  school    School   @relation(fields: [schoolId], references: [id])
  schoolId  String    @db.ObjectId
  name      String
  url       String?
  adminName String
  contact   String
  email     String @unique
}

// Create a join model for many-to-many relations
model ProposalReviewer {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  proposal    Proposal @relation("ProposalReviewers", fields: [proposalId], references: [id])
  proposalId  String    @db.ObjectId
  reviewer    Reviewer @relation("ReviewerProposals", fields: [reviewerId], references: [id])
  reviewerId  String
}
