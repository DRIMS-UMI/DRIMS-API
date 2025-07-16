import emailService from '../../../services/emailService.js';
import { updateResultsSentDate } from './managementEvaluationController.js';

class EmailController {
    // Send results email with Excel attachment
    async sendResultsEmail(req, res) {
        try {
            const {
                to,
                subject,
                message,
                schoolName,
                academicYear,
                studentCount,
                excelBuffer,
                fileName,
                studentIds // Array of student IDs to update results sent date
            } = req.body;

            // Validate required fields
            if (!to || !subject || !schoolName || !excelBuffer || !fileName) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: to, subject, schoolName, excelBuffer, fileName'
                });
            }

            // Send email with attachment
            const emailResult = await emailService.sendResultsEmail({
                to,
                subject,
                message,
                schoolName,
                academicYear,
                studentCount,
                excelBuffer,
                fileName
            });

            // Update results sent date for all students if studentIds provided
            if (studentIds && studentIds.length > 0) {
                const sentDate = new Date().toISOString().split('T')[0];
                
                // Create a mock request object for each student update
                const updatePromises = studentIds.map(async (studentId) => {
                    const mockReq = {
                        params: { studentId },
                        body: { resultsSentDate: sentDate },
                        user: req.user // Pass the current user for activity logging
                    };
                    const mockRes = {
                        status: () => ({ json: () => {} }),
                        json: () => {}
                    };
                    
                    try {
                        await updateResultsSentDate(mockReq, mockRes, () => {});
                    } catch (error) {
                        console.error(`Error updating student ${studentId}:`, error);
                        throw error;
                    }
                });
                
                await Promise.all(updatePromises);
            }

            res.status(200).json({
                success: true,
                message: 'Results email sent successfully',
                data: {
                    messageId: emailResult.messageId,
                    schoolName,
                    studentCount,
                    fileName
                }
            });

        } catch (error) {
            console.error('Error in sendResultsEmail:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send results email',
                error: error.message
            });
        }
    }

    // Test email service connection
    async testEmailConnection(req, res) {
        try {
            const isConnected = await emailService.testConnection();
            
            if (isConnected) {
                res.status(200).json({
                    success: true,
                    message: 'Email service connection successful'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Email service connection failed'
                });
            }
        } catch (error) {
            console.error('Error testing email connection:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to test email connection',
                error: error.message
            });
        }
    }
}

export default new EmailController(); 