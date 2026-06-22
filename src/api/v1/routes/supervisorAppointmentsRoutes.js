import express from 'express';
import * as supervisorAppointmentsController from '../controllers/supervisorAppointmentsController.js';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';

const router = express.Router();

// Base path: /api/v1/supervisor/appointments
router.use(authenticateToken);
router.use(authorizeRoles('SUPERVISOR'));

// Availabilities
router.get('/availability', supervisorAppointmentsController.getAvailabilities);
router.post('/availability', supervisorAppointmentsController.addAvailability);
router.delete('/availability/:id', supervisorAppointmentsController.deleteAvailability);

// Appointments
router.get('/', supervisorAppointmentsController.getAppointments);
router.put('/:id/status', supervisorAppointmentsController.updateAppointment);

export default router;
