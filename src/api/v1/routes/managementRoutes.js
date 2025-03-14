import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { registerSuperAdmin, accessManagementPortal, loginSuperAdmin, loginResearchCentreAdmin, getLoggedInUserDetails, addSchool, addSchoolMembers, getAllSchools, getSchool, updateSchool, deleteSchool, createCampus, getAllCampuses, getCampus, updateCampus, deleteCampus, addDepartment, getAllDepartments, getDepartment, updateDepartment, deleteDepartment } from '../controllers/managementController.js';


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

// School management routes
router.post('/schools', authenticateToken, authorizeRoles('SUPERADMIN'), addSchool);
router.post('/schools/:schoolId/members', authenticateToken, authorizeRoles('SUPERADMIN'), addSchoolMembers);
router.get('/schools', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllSchools);
router.get('/schools/:schoolId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getSchool);
router.put('/schools/:schoolId', authenticateToken, authorizeRoles('SUPERADMIN'), updateSchool);
router.delete('/schools/:schoolId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteSchool);

// Campus management routes
router.post('/campuses', authenticateToken, authorizeRoles('SUPERADMIN'), createCampus);
router.get('/campuses', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllCampuses);
router.get('/campuses/:campusId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getCampus);
router.put('/campuses/:campusId', authenticateToken, authorizeRoles('SUPERADMIN'), updateCampus);
router.delete('/campuses/:campusId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteCampus);

// Department management routes
router.post('/schools/:schoolId/departments', authenticateToken, authorizeRoles('SUPERADMIN'), addDepartment);
router.get('/schools/:schoolId/departments', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllDepartments);
router.get('/schools/:schoolId/departments/:departmentId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getDepartment);
router.put('/schools/:schoolId/departments/:departmentId', authenticateToken, authorizeRoles('SUPERADMIN'), updateDepartment);
router.delete('/schools/:schoolId/departments/:departmentId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteDepartment);

router.get('/management', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), accessManagementPortal);

export default router; 