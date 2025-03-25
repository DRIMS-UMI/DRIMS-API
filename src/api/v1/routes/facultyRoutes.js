import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Import faculty controllers
import { loginFaculty, getFacultyProfile, updateFacultyPassword, getStudent, getAllStudents, getStudentStatuses, submitProposal, getProposal, gradeProposal, getStudentProposals } from '../controllers/facultyController.js';

// Faculty authentication routes
router.post('/login', loginFaculty);

// Protected faculty routes
router.get('/profile', authenticateToken, getFacultyProfile);
router.put('/password', authenticateToken, updateFacultyPassword);

// Student management routes
router.get('/students/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudent);
router.get('/students', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllStudents);
router.get('/students/:studentId/statuses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentStatuses);

// Proposal management routes
router.post('/proposals/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), upload.single('proposalFile'), submitProposal);
router.get('/proposals/:studentId/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getProposal);
router.post('/proposals/:studentId/:proposalId/grade', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), gradeProposal);
router.get('/proposals/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentProposals);

export default router;