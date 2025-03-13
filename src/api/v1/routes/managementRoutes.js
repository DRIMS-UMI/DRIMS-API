import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { registerSuperAdmin, accessManagementPortal, loginSuperAdmin, loginResearchCentreAdmin, getLoggedInUserDetails } from '../controllers/managementController.js';


const router = express.Router();

// Management portal route

// One-time SuperAdmin registration route
router.post('/register-superadmin', registerSuperAdmin);

// SuperAdmin login route
router.post('/login/super-admin', loginSuperAdmin);

// Research Centre Admin login route
router.post('/login/research-centre-admin', loginResearchCentreAdmin);

// Get logged in user details route
router.get('/user/details', authenticateToken, getLoggedInUserDetails);

router.get('/management', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), accessManagementPortal);

export default router; 