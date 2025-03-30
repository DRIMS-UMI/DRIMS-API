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
import { loginFaculty, getFacultyProfile, updateFacultyPassword, getStudent, getAllStudents, getStudentStatuses, submitProposal, getProposal, gradeProposal, getStudentProposals, addReviewers, getReviewers, addPanelists, getPanelists, getSchoolProposals, deleteReviewer, deletePanelist, addReviewerMark, addPanelistMark, addDefenseDate, addComplianceReportDate } from '../controllers/facultyController.js';

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
router.post('/proposals/:studentId/:proposalId/grade', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), gradeProposal);
router.get('/proposals/:studentId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getStudentProposals);
router.post('/proposals/:proposalId/defense-date', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addDefenseDate);
router.post('/proposals/:proposalId/compliance-report-date', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addComplianceReportDate);

// Reviewer management routes
router.post('/reviewers/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addReviewers);
router.get('/reviewers', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getReviewers);
router.delete('/reviewers/:proposalId/:reviewerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deleteReviewer);

// Panelist management routes
router.post('/panelists/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addPanelists);
router.get('/panelists', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getPanelists);
router.delete('/panelists/:proposalId/:panelistId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), deletePanelist);

// Get all proposals in a school
router.get('/proposals', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getSchoolProposals);
router.get('/proposal/:proposalId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), getProposal);

// Add reviewer mark to proposal
router.post('/reviewer-marks/:proposalId/:reviewerId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addReviewerMark);

// Add panelist mark to proposal
router.post('/panelist-marks/:proposalId/:panelistId', authenticateToken, authorizeRoles('SCHOOL_ADMIN'), addPanelistMark);

export default router;