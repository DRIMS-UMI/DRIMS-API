import express from 'express';
import emailController from '../controllers/emailController.js';

const router = express.Router();

// Send results email with Excel attachment
router.post('/send-results', emailController.sendResultsEmail);

// Test email service connection
router.get('/test-connection', emailController.testEmailConnection);

export default router; 