import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { GridFsStorage } from "multer-gridfs-storage";
import mongoose from "mongoose";

const mongoURI = process.env.DATABASE_URL;

// Create a connection to MongoDB
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads',
  });
});

// Configure GridFS storage
const storage = new GridFsStorage({
  url: mongoURI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      try {
        const fileId = new mongoose.Types.ObjectId();
        const filename = `${Date.now()}-${file.originalname}`;
        const fileInfo = {
          _id: fileId,
          filename: filename,
          bucketName: 'uploads',
          metadata: {
            proposalId: req.params.proposalId,
            uploadedBy: req.user?.id || 'unknown',
            contentType: file.mimetype,
            originalname: file.originalname
          }
        };
        resolve(fileInfo);
      } catch (error) {
        reject(error);
      }
    });
  }
});

// Configure multer for memory storage
const memoryStorage = multer.memoryStorage();
const upload = multer({ 
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    // Accept only .docx files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Error handling middleware for multer
export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File size too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      message: error.message
    });
  }
  next(error);
};

const router = express.Router();

// Import faculty controllers
import { loginFaculty, getFacultyProfile, updateFacultyPassword, getStudent, getAllStudents, getStudentStatuses, submitProposal, getProposal, gradeProposal, getStudentProposals, addReviewers, getReviewers, addPanelists, getPanelists, getSchoolProposals, deleteReviewer, deletePanelist, addReviewerMark, addPanelistMark, addDefenseDate, addComplianceReportDate, updateFieldLetterDate, getAllBooks, getBook, getStudentBooks, createExaminer, getAllExaminers, getExaminer, updateExaminer, deleteExaminer, assignExaminersToBook, updateInternalExaminerMark, getProposalDefenses, recordProposalDefenseVerdict, scheduleProposalDefense, getProgressTrends, getStatusStatistics, getDashboardStats, getNotifications, getAllStudentsStatusReport, getStudentStatusReport, addNewPanelist, getAllSupervisors, requestPasswordReset, resetPassword, updateFacultyProfile, addNewReviewer, getChairpersons, getExternalPersons, getExternalPersonsByRole, createExternalPerson, updateExternalPerson, deleteExternalPerson, updateEthicsCommitteeDate, generateDefenseReport, getProposalDefenseReports, downloadDefenseReport, getAllFacultyMembers, getAllCampuses, getAllDepartments, getAllSchools, createSupervisor, getAssignedStudents, deleteSupervisor, updateSupervisor, getSupervisor, assignStudentsToSupervisor, changeStudentSupervisor } from '../controllers/facultyController.js';

// Faculty authentication routes
router.post('/login', loginFaculty);

// Protected faculty routes
router.get('/profile', authenticateToken, getFacultyProfile);
router.put('/password', authenticateToken, updateFacultyPassword);
router.put('/profile', authenticateToken, updateFacultyProfile);
// Student management routes
router.get('/students/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudent);
router.get('/students', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllStudents);
router.get('/students/:studentId/statuses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentStatuses);

// Proposal management routes
router.post('/proposals/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), upload.single('proposalFile'), submitProposal);
router.post('/proposals/:studentId/:proposalId/grade', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), gradeProposal);
router.get('/proposals/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentProposals);
router.post('/proposals/:proposalId/defense-date', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addDefenseDate);
router.post('/proposals/:proposalId/compliance-report-date', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addComplianceReportDate);

// Reviewer management routes
router.post('/reviewers/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addReviewers);
// Add new reviewer route
router.post('/reviewer', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addNewReviewer);

router.get('/reviewers', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getReviewers);
router.delete('/reviewers/:proposalId/:reviewerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deleteReviewer);

// Panelist management routes - remove the first two
router.post('/panelists/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addPanelists);
router.get('/panelists', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getPanelists);
router.post('/panelists', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addNewPanelist);
router.delete('/panelists/:proposalId/:panelistId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deletePanelist);

//Chairpersons
router.get('/chairperson', authenticateToken, authorizeRoles("SCHOOL_ADMIN"), getChairpersons)

// External persons routes
router.get('/external-persons', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getExternalPersons);
router.get('/external-persons/:role', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getExternalPersonsByRole);
router.post('/external-person', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), createExternalPerson);
router.put('/external-person/:id', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateExternalPerson);
router.delete('/external-person/:id', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deleteExternalPerson);


// Get all proposals in a school
router.get('/proposals', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getSchoolProposals);
router.get('/proposal/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getProposal);

// Add reviewer mark to proposal
router.post('/reviewer-marks/:proposalId/:reviewerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addReviewerMark);

// Add panelist mark to proposal
router.post('/panelist-marks/:proposalId/:panelistId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addPanelistMark);

// Generate and send field letter
// router.post('/generate-field-letter/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), upload.single('docxFile'), generateFieldLetter);

// Update field letter date
router.put('/update-field-letter-date/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateFieldLetterDate);

// Update ethics committee date
router.put('/update-ethics-committee-date/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateEthicsCommitteeDate);

// Book management routes
router.get('/books', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllBooks);
router.get('/books/:bookId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getBook);
router.get('/student-books/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentBooks);

// Examiner management routes
router.post('/examiners', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), createExaminer);
router.get('/examiners', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllExaminers);
router.get('/examiners/:examinerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getExaminer);
router.put('/examiners/:examinerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateExaminer);
router.delete('/examiners/:examinerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deleteExaminer);

// Examiner assignment routes
router.post('/books/:bookId/examiners', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), assignExaminersToBook);
router.put('/internal-examiner-mark/:assignmentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateInternalExaminerMark);

// Proposal defense routes
router.post('/proposals/:proposalId/defenses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), scheduleProposalDefense);
router.put('/defenses/:defenseId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), recordProposalDefenseVerdict);
router.get('/defenses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getProposalDefenses);    

// Defense Report routes with error handling
router.post(
  '/generate-defense-report/:proposalId', 
  authenticateToken, 
  authorizeRoles('SCHOOL_ADMIN'), 
  upload.single('reportFile'),
  handleMulterError,
  generateDefenseReport
);

router.get(
  '/defense-reports/:reportId/download',
  authenticateToken,
  authorizeRoles('SCHOOL_ADMIN'),
  downloadDefenseReport
);

router.get(
  '/proposal/:proposalId/defense-reports',
  authenticateToken,
  authorizeRoles('SCHOOL_ADMIN'),
  getProposalDefenseReports
);

// Dashboard routes
router.get('/dashboard/stats', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getDashboardStats);
router.get('/dashboard/status-statistics', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStatusStatistics);
router.get('/dashboard/progress-trends', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getProgressTrends);

// Notification routes
router.get('/notifications', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getNotifications);
router.get('/students/status-report', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllStudentsStatusReport);
router.get('/students/:studentId/status-report', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentStatusReport);

// Supervisor routes
router.get('/supervisors', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllSupervisors);

// Password reset routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Faculty management routes
router.get('/faculty', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllFacultyMembers);

// Campus management routes
router.get('/campuses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllCampuses);

// School management routes
router.get('/schools/:schoolId/departments', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllDepartments);
router.get('/schools', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllSchools);

// Supervisor management routes
router.post('/supervisor', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), createSupervisor);

router.get('/supervisor/:supervisorId', authenticateToken,authorizeRoles('SCHOOL_ADMIN'), getSupervisor);

router.get('/supervisor/:supervisorId/students', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAssignedStudents);

router.put('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), updateSupervisor);

router.delete('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deleteSupervisor);

router.post('/supervisor/:supervisorId/assign-students', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), assignStudentsToSupervisor);

// Change supervisor route
router.put('/students/:studentId/change-supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), changeStudentSupervisor);
export { gfs }; // Export gfs for use in controllers
export default router;