import express from 'express';
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
  listAllSupervisorsForMessaging
} from '../controllers/studentController.js';

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

// Supervisors for messaging routes
router.get('/supervisors-for-messaging', authenticateToken, authorizeRoles('STUDENT'), listAllSupervisorsForMessaging);

export default router; 