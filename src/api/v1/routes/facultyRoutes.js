import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';

const router = express.Router();

// Import faculty controllers
import { loginFaculty, getFacultyProfile, updateFacultyPassword } from '../controllers/facultyController.js';

// Faculty authentication routes
router.post('/login', loginFaculty);

// Protected faculty routes
router.get('/profile', authenticateToken, getFacultyProfile);
router.put('/password', authenticateToken, updateFacultyPassword);


export default router;