import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import {
    registerSuperAdmin,
    loginSuperAdmin,
    loginResearchCentreAdmin,
    getLoggedInUserDetails,
    updateLoggedInUser,
    updateUserProfile,
    changePassword,
    createCampus,
    getAllCampuses,
    getCampus,
    updateCampus,
    deleteCampus,
    addSchool,
    addSchoolMembers,
    updateSchoolMembers,
    addDepartment,
    getAllDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment,
    getAllSchools,
    getSchool,
    updateSchool,
    deleteSchool,
    createFacultyMember,
    getAllFacultyMembers,
    getFacultyMember,
    updateFacultyMember,
    changeFacultyPassword,
    deleteFacultyMember,
  
    getAllSupervisors,
    getSupervisor,
    updateSupervisor,
    deleteSupervisor,
    changeSupervisorPassword,
    assignSupervisorsToStudent,
    assignStudentsToSupervisor,
    changeStudentSupervisor,
    getAssignedStudents,
    createStudent,
    updateStudent,
    changeStudentPassword,
    deleteStudent,
    getStudent,
    getAllStudents,
    getStudentStatuses,
    createStatusDefinition,
    getAllStatusDefinitions,
    getStatusDefinition,
    updateStatusDefinition,
    deleteStatusDefinition,
    getStudentProposals,
    getAllProposals,
    getProposal,
    getReviewers,
    addReviewerMark,
    deleteReviewer,
    getPanelists,
    addPanelists,
    addPanelistMark,
    deletePanelist,
    getChairpersons,
    getExternalPersons,
    getExternalPersonsByRole,
    createExternalPerson,
    updateExternalPerson,
    deleteExternalPerson,
    addDefenseDate,
    addComplianceReportDate,
    generateFieldLetter,
    updateFieldLetterDate,
    updateEthicsCommitteeDate,
    generateDefenseReport,
    getProposalDefenseReports,
    downloadDefenseReport,
    submitStudentBook,
    getStudentBooks,
    getAllBooks,
    getBook,
    createExaminer,
    getAllExaminers,
    assignExaminersToBook,
    getExaminer,
    updateExternalExaminerMark,
    updateExaminer,
    deleteExaminer,
    createUser,
    getAllUsers,
    deactivateUser,
    reactivateUser,
    updateUser,
    getUser,
    deleteUser,
    updateUserPassword,
    addPanelistsToBook,
    accessManagementPortal,
    scheduleProposalDefense,
    recordProposalDefenseVerdict,
    getProposalDefenses,
    createStaffMember,
    getAllStaffMembers,
    getStaffMember,
    updateStaffMember,
    deleteStaffMember,
    getStaffMembersByRole,
    getStaffMembersForSupervisor,
    createSupervisorFromStaff,
} from '../controllers/managementController.js';
import {getEvaluationAnalytics, getDetailedEvaluations, updateResearchRequest, getAllResearchRequests, addStudentToGraduation, resetPassword, requestPasswordReset, getNotifications, getAllStudentsStatusReport, getStudentStatusReport, getProgressTrends, getStatusStatistics, getDashboardStats, updateSenateApprovalDate, updateResultsSentDate, updateResultsApprovalDate, updateComplianceReportDate, updateMinutesSentDate, getBookVivas, getAllPanelists, addNewPanelist, scheduleViva, recordVivaVerdict, getGraduationStatistics } from "../controllers/managementEvaluationController.js"

const memoryStorage = multer.memoryStorage();
const upload = multer({ 
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    // Accept only .docx files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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

router.post('/supervisor/from-staff/:staffMemberId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createSupervisorFromStaff);
router.get('/supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllSupervisors);
router.get('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getSupervisor);
router.put('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN'), updateSupervisor);
router.delete('/supervisor/:supervisorId', authenticateToken, authorizeRoles('SUPERADMIN'), deleteSupervisor);
router.put('/supervisor/:supervisorId/password', authenticateToken, authorizeRoles('SUPERADMIN'), changeSupervisorPassword);
router.post('/supervisor/:supervisorId/assign-students', authenticateToken, authorizeRoles('SUPERADMIN'), assignStudentsToSupervisor);
router.post('/students/:studentId/assign-supervisors', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), assignSupervisorsToStudent )
router.get('/supervisor/:supervisorId/students', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAssignedStudents);
// Change supervisor route
router.put('/students/:studentId/change-supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), changeStudentSupervisor);


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

// Update field letter date
router.put('/update-field-letter-date/:proposalId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateFieldLetterDate);

// Update ethics committee date
router.put('/update-ethics-committee-date/:proposalId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateEthicsCommitteeDate);

// Student profile progress management routes
router.put('/students/:studentId/results-approved', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateResultsApprovalDate);
router.put('/students/:studentId/results-sent', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateResultsSentDate);
router.put('/students/:studentId/senate-approval', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateSenateApprovalDate); 

// Dashboard routes
router.get('/dashboard/stats', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getDashboardStats);
router.get('/dashboard/status-statistics', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStatusStatistics);
router.get('/dashboard/progress-trends', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getProgressTrends);

// Notification routes
router.get('/notifications', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getNotifications);
router.get('/students/status-report', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllStudentsStatusReport);
router.get('/students/:studentId/status-report', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStudentStatusReport);

// Faculty statistics routes
router.get('/reviewers', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getReviewers);

//Chairpersons
router.get('/chairperson', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getChairpersons)

// External persons routes
router.get('/external-persons', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getExternalPersons);
router.get('/external-persons/:role', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getExternalPersonsByRole);
router.post('/external-person', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createExternalPerson);
router.put('/external-person/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateExternalPerson);
router.delete('/external-person/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), deleteExternalPerson);

// Proposal defense routes
router.post('/proposals/:proposalId/defenses', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), scheduleProposalDefense);
router.put('/defenses/:defenseId', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), recordProposalDefenseVerdict);
router.get('/defenses', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getProposalDefenses);  

// Defense Report routes with error handling
router.post(
    '/generate-defense-report/:proposalId', 
    authenticateToken, 
    authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), 
    upload.single('reportFile'),
 
    generateDefenseReport
  );
  
  router.get(
    '/defense-reports/:reportId/download',
    authenticateToken,
    authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'),
    downloadDefenseReport
  );
  
  router.get(
    '/proposal/:proposalId/defense-reports',
    authenticateToken,
    authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'),
    getProposalDefenseReports
  );

// Password reset routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// User profile routes
router.put('/profile', authenticateToken, updateUserProfile);
router.put('/profile/password', authenticateToken, changePassword);

// Graduation routes
router.get('/graduation', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getGraduationStatistics);
router.post("/graduation", authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), addStudentToGraduation);

// Research Request management routes
router.get('/research-requests', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllResearchRequests);
router.put('/research-requests/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateResearchRequest);

// Student Evaluation Analytics routes
router.get('/evaluations/analytics', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getEvaluationAnalytics);
router.get('/evaluations/detailed', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getDetailedEvaluations);

// Staff Management routes
router.get('/staff', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getAllStaffMembers);
router.get('/staff/for-supervisor', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStaffMembersForSupervisor);
router.post('/staff', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), createStaffMember);
router.get('/staff/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStaffMember);
router.put('/staff/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), updateStaffMember);
router.delete('/staff/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), deleteStaffMember);
router.get('/staff/role/:role', authenticateToken, authorizeRoles('SUPERADMIN', 'RESEARCH_ADMIN'), getStaffMembersByRole);

export default router;  