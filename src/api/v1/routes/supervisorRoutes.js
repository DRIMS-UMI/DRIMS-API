import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { 
  loginSupervisor, 
  getSupervisorProfile, 
  updateSupervisorProfile,
  changePassword,
  logoutSupervisor,
  getAssignedStudents,
  getStudentDetails,
  updateStudentProgress,
  getStudentProposals,
  reviewProposal,
  getDashboardStats,
  getNotifications,
  getStudentStatuses,
  getStudentBooks,
  getSchoolProposals,
  getAllBooks,
  listAllStudentsForMessaging,
  getStatusStatistics,
  getStudentDocuments,
  downloadStudentDocument,
  uploadReviewedDocument
} from '../controllers/supervisorController.js';

// Configure multer for file uploads
const memoryStorage = multer.memoryStorage();
const upload = multer({ 
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOC, DOCX files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
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

// Authentication routes
router.post('/login', loginSupervisor);
router.post('/logout', authenticateToken, authorizeRoles('SUPERVISOR'), logoutSupervisor);

// Profile routes
router.get('/profile', authenticateToken, authorizeRoles('SUPERVISOR'), getSupervisorProfile);
router.put('/profile', authenticateToken, authorizeRoles('SUPERVISOR'), updateSupervisorProfile);
router.put('/password', authenticateToken, authorizeRoles('SUPERVISOR'), changePassword);

// Student management routes
router.get('/students', authenticateToken, authorizeRoles('SUPERVISOR'), getAssignedStudents);
router.get('/students/:studentId', authenticateToken, authorizeRoles('SUPERVISOR'), getStudentDetails);
router.put('/students/:studentId/progress', authenticateToken, authorizeRoles('SUPERVISOR'), updateStudentProgress);
router.get('/students/:studentId/statuses', authenticateToken, authorizeRoles('SUPERVISOR'), getStudentStatuses);
router.get('/students-for-messaging', authenticateToken, authorizeRoles('SUPERVISOR'), listAllStudentsForMessaging);

// Proposal management routes
router.get('/students/:studentId/proposals', authenticateToken, authorizeRoles('SUPERVISOR'), getStudentProposals);
router.put('/proposals/:proposalId/review', authenticateToken, authorizeRoles('SUPERVISOR'), reviewProposal);
router.get('/proposals', authenticateToken, authorizeRoles('SUPERVISOR'), getSchoolProposals);

// dissertation /book management routes
router.get('/student-books/:studentId', authenticateToken, authorizeRoles('SUPERVISOR'), getStudentBooks);
router.get('/books', authenticateToken, authorizeRoles('SUPERVISOR'), getAllBooks);

// Document management routes
router.get('/students/:studentId/documents', authenticateToken, authorizeRoles('SUPERVISOR'), getStudentDocuments);
router.get('/documents/:documentId/download', authenticateToken, authorizeRoles('SUPERVISOR'), downloadStudentDocument);
router.post('/documents/:documentId/review', authenticateToken, authorizeRoles('SUPERVISOR'), upload.single('file'), handleMulterError, uploadReviewedDocument);

// Dashboard routes
router.get('/dashboard/stats', authenticateToken, authorizeRoles('SUPERVISOR'), getDashboardStats);
router.get('/dashboard/status-statistics', authenticateToken, authorizeRoles('SUPERVISOR'), getStatusStatistics);
router.get('/notifications', authenticateToken, authorizeRoles('SUPERVISOR'), getNotifications);

export default router; 