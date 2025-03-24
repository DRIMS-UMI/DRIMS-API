import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';

const router = express.Router();

// Import faculty controllers
import { loginFaculty, getFacultyProfile, updateFacultyPassword, getStudent, getAllStudents, getStudentStatuses } from '../controllers/facultyController.js';

// Faculty authentication routes
router.post('/login', loginFaculty);

// Protected faculty routes
router.get('/profile', authenticateToken, getFacultyProfile);
router.put('/password', authenticateToken, updateFacultyPassword);

// Student management routes
router.get('/students/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudent);
router.get('/students', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getAllStudents);
router.get('/students/:studentId/statuses', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentStatuses);



export default router;