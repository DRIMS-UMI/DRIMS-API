import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { 
  loginStudent,
  getLoggedInUser,
  getStudentProfile,
  updateStudentProfile,
  changeStudentPassword,
  getStudentDashboardStats,
  getStudentNotifications,
  markNotificationAsRead,
  logoutStudent,
  getStudentStatuses,
  getStudentProposals,
  getStudentBooks,
  getStudentResearchRequests,
  createResearchRequest,
  getResearchRequest,
  listAllSupervisorsForMessaging,
  getAvailableEvaluations,
  submitStudentEvaluation,
  getStudentEvaluations,
  uploadDocument,
  getStudentDocuments,
  downloadDocument,
  deleteDocument,
  getStudentResearchClinicBookings,
  cancelResearchClinicBooking,
  getAvailableResearchClinicDays,
  bookResearchClinicSession,
} from '../controllers/studentController.js';

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
router.post('/login', loginStudent);
router.post('/logout', authenticateToken, authorizeRoles('STUDENT'), logoutStudent);

// User information routes
router.get('/logged-in-user', authenticateToken, authorizeRoles('STUDENT'), getLoggedInUser);

// Profile routes
router.get('/profile', authenticateToken, authorizeRoles('STUDENT'), getStudentProfile);
router.put('/profile', authenticateToken, authorizeRoles('STUDENT'), updateStudentProfile);
router.put('/password', authenticateToken, authorizeRoles('STUDENT'), changeStudentPassword);

// Dashboard routes
router.get('/dashboard/stats', authenticateToken, authorizeRoles('STUDENT'), getStudentDashboardStats);

// Notification routes
router.get('/notifications', authenticateToken, authorizeRoles('STUDENT'), getStudentNotifications);
router.put('/notifications/:notificationId/read', authenticateToken, authorizeRoles('STUDENT'), markNotificationAsRead);

// Status routes
router.get('/statuses/:studentId', authenticateToken, authorizeRoles('STUDENT'), getStudentStatuses);

// Proposal routes
router.get('/proposals/:studentId', authenticateToken, authorizeRoles('STUDENT'), getStudentProposals);

// Book routes
router.get('/books/:studentId', authenticateToken, authorizeRoles('STUDENT'), getStudentBooks);

// Research Request routes
router.get('/research-requests', authenticateToken, authorizeRoles('STUDENT'), getStudentResearchRequests);
router.post('/research-requests', authenticateToken, authorizeRoles('STUDENT'), createResearchRequest);
router.get('/research-requests/:requestId', authenticateToken, authorizeRoles('STUDENT'), getResearchRequest);

// Evaluation routes
router.get('/evaluations/available', authenticateToken, authorizeRoles('STUDENT'), getAvailableEvaluations);
router.post('/evaluations', authenticateToken, authorizeRoles('STUDENT'), submitStudentEvaluation);
router.get('/evaluations', authenticateToken, authorizeRoles('STUDENT'), getStudentEvaluations);

// Supervisors for messaging routes
router.get('/supervisors-for-messaging', authenticateToken, authorizeRoles('STUDENT'), listAllSupervisorsForMessaging);

// Document management routes
router.post('/documents', authenticateToken, authorizeRoles('STUDENT'), upload.single('file'), handleMulterError, uploadDocument);
router.get('/documents', authenticateToken, authorizeRoles('STUDENT'), getStudentDocuments);
router.get('/documents/:documentId/download', authenticateToken, authorizeRoles('STUDENT'), downloadDocument);
router.delete('/documents/:documentId', authenticateToken, authorizeRoles('STUDENT'), deleteDocument);

// Document routes
router.get('/students/:studentId/documents', authenticateToken, getStudentDocuments);
router.post('/students/:studentId/documents', authenticateToken, uploadDocument);
router.get('/students/:studentId/documents/:documentId/download', authenticateToken, downloadDocument);
router.delete('/students/:studentId/documents/:documentId', authenticateToken, deleteDocument);

// Research Clinic routes
router.get('/research-clinic-days', authenticateToken, authorizeRoles('STUDENT'), getAvailableResearchClinicDays);
router.post('/research-clinic-bookings', authenticateToken, authorizeRoles('STUDENT'), bookResearchClinicSession);
router.get('/research-clinic-bookings', authenticateToken, authorizeRoles('STUDENT'), getStudentResearchClinicBookings);
router.put('/research-clinic-bookings/:bookingId/cancel', authenticateToken, authorizeRoles('STUDENT'), cancelResearchClinicBooking);

export default router; 