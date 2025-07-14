import express from 'express';
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
  listAllStudentsForMessaging
} from '../controllers/supervisorController.js';

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
// Dashboard routes
router.get('/dashboard/stats', authenticateToken, authorizeRoles('SUPERVISOR'), getDashboardStats);
router.get('/notifications', authenticateToken, authorizeRoles('SUPERVISOR'), getNotifications);

export default router; 