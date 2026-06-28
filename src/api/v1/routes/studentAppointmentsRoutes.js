import express from 'express';
import * as studentAppointmentsController from '../controllers/studentAppointmentsController.js';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';

const router = express.Router();

// Base path: /api/v1/student/appointments
router.use(authenticateToken);
router.use(authorizeRoles('STUDENT'));

// Availabilities
router.get('/availability', studentAppointmentsController.getAvailableAppointments);

// Appointments
router.post('/', studentAppointmentsController.bookAppointment);
router.get('/', studentAppointmentsController.getStudentAppointments);
router.put('/:appointmentId/reschedule', studentAppointmentsController.rescheduleAppointment);
router.put('/:appointmentId/cancel', studentAppointmentsController.cancelAppointment);

export default router;
