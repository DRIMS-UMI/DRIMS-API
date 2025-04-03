import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { registerSuperAdmin, accessManagementPortal, loginSuperAdmin, loginResearchCentreAdmin, getLoggedInUserDetails, addSchool, addSchoolMembers, getAllSchools, getSchool, updateSchool, deleteSchool, createCampus, getAllCampuses, getCampus, updateCampus, deleteCampus, addDepartment, getAllDepartments, getDepartment, updateDepartment, deleteDepartment, updateSchoolMembers, createFacultyMember, getAllFacultyMembers, getFacultyMember, updateFacultyMember, deleteFacultyMember, createSupervisor, createStudent, updateStudent, deleteStudent, getStudent, getAllStudents, changeStudentPassword, createStatusDefinition, getAllStatusDefinitions, getStatusDefinition, updateStatusDefinition, deleteStatusDefinition, changeFacultyPassword, getAllSupervisors, getSupervisor, updateSupervisor, deleteSupervisor, assignStudentsToSupervisor, getAssignedStudents, getStudentStatuses, getAllProposals, getProposal, getStudentProposals, submitStudentBook, getStudentBooks, getAllBooks, getBook, createExaminer, getAllExaminers, getExaminer, updateExaminer, deleteExaminer, assignExaminersToBook, updateExternalExaminerMark, getAllUsers, createUser, updateUser, deleteUser, updateUserPassword, deactivateUser, reactivateUser, getUser, addPanelistsToBook, scheduleViva, recordVivaVerdict, addNewPanelist, getAllPanelists, getBookVivas, updateMinutesSentDate, updateComplianceReportDate } from '../controllers/managementController.js';


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
router.put('/schools/:schoolId/members', authenticateToken, authorizeRoles('SUPERADMIN'), updateSchoolMembers);
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

// Faculty management routes
router.post('/faculty', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createFacultyMember);  
router.get('/faculty', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllFacultyMembers);
router.get('/faculty/:facultyId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getFacultyMember);
router.put('/faculty/:facultyId', authenticateToken, authorizeRoles('SUPERADMIN'), updateFacultyMember);
router.delete('/faculty/:facultyId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteFacultyMember);
router.put('/faculty/:facultyId/password', authenticateToken, authorizeRoles('SUPERADMIN'), changeFacultyPassword);

// Supervisor management routes
router.post('/supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createSupervisor);
router.get('/supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllSupervisors);
router.get('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getSupervisor);
router.put('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN'), updateSupervisor);
router.delete('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteSupervisor);
router.post('/supervisor/:supervisorId/assign-students', authenticateToken, authorizeRoles('SUPERADMIN'), assignStudentsToSupervisor);
router.get('/supervisor/:supervisorId/students', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAssignedStudents);

// Student management routes
router.post('/students', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createStudent);
router.put('/students/:studentId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateStudent);
router.delete('/students/:studentId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), deleteStudent);
router.get('/students/:studentId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStudent);
router.get('/students', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllStudents);     
router.put('/students/:studentId/password', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), changeStudentPassword);
router.get('/students/:studentId/statuses', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStudentStatuses);

// Status management routes
router.post('/status-definitions', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createStatusDefinition);
router.get('/status-definitions', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllStatusDefinitions);
router.get('/status-definitions/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStatusDefinition);
router.put('/status-definitions/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateStatusDefinition);
router.delete('/status-definitions/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), deleteStatusDefinition);

// Proposal management routes
router.get('/proposals', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllProposals);
router.get('/proposals/:proposalId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getProposal);
// Student proposal routes
router.get('/students/:studentId/proposals', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStudentProposals);

// router.put('/proposals/:proposalId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateProposal);
// router.delete('/proposals/:proposalId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), deleteProposal);

// Student book routes
router.post('/students/:studentId/books', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), submitStudentBook);
router.get('/students/:studentId/books', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStudentBooks);

// Grade Book management routes
router.get('/books', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllBooks);
router.get('/books/:bookId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getBook);

router.get('/management', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), accessManagementPortal);


// Examiner management routes
router.post('/examiners', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createExaminer);
router.get('/examiners', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllExaminers);
router.get('/examiners/:examinerId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getExaminer);
router.put('/examiners/:examinerId', authenticateToken, authorizeRoles('SUPERADMIN'), updateExaminer);
router.delete('/examiners/:examinerId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteExaminer);   

// Book-Examiner assignment routes
router.post('/books/:bookId/examiners', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), assignExaminersToBook);
// router.post('/books/:bookId/panelists', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), addPanelistsToBook); 

// Examiner mark routes
router.post('/examiner-marks/:assignmentId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateExternalExaminerMark);

// User roles management routes
router.get('/users', authenticateToken, authorizeRoles('SUPERADMIN'), getAllUsers);
router.get('/users/:userId', authenticateToken, authorizeRoles('SUPERADMIN'), getUser);
router.post('/users', authenticateToken, authorizeRoles('SUPERADMIN'), createUser);
router.put('/users/:userId', authenticateToken, authorizeRoles('SUPERADMIN'), updateUser);
router.delete('/users/:userId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteUser);   
router.put('/users/:userId/password', authenticateToken, authorizeRoles('SUPERADMIN'), updateUserPassword);
router.put('/users/:userId/deactivate', authenticateToken, authorizeRoles('SUPERADMIN'), deactivateUser);
router.put('/users/:userId/reactivate', authenticateToken, authorizeRoles('SUPERADMIN'), reactivateUser);

// Viva management routes
router.post('/books/:bookId/viva', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), scheduleViva);
router.put('/viva/:vivaId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), recordVivaVerdict);

// Panelist management routes
router.post('/panelists', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), addNewPanelist);
router.get('/panelists', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllPanelists);
router.get('/books/:bookId/viva', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getBookVivas);

// Compliance report management routes
router.put('/books/:bookId/minutes-sent', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateMinutesSentDate);
router.put('/books/:bookId/compliance-report', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateComplianceReportDate);          

export default router;  