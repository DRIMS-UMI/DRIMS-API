import validator from 'validator';
import prisma from '../../../utils/db.mjs';
import emailService from '../../../services/emailService2.js';
import { updateResultsSentDate } from './managementEvaluationController.js';

const MAX_RECIPIENTS = 10;
const MAX_SUBJECT_LENGTH = 200;
// Same roles as PUT /management/students/:studentId/results-sent
const RESULTS_SENT_ROLES = ['SUPERADMIN', 'RESEARCH_ADMIN'];

/** Makes a client-built name (e.g. "School of X_Results_2024/2025.xlsx") safe as an attachment name. */
const safeXlsxName = (name) => {
    const base = String(name).replace(/\.xlsx$/i, '').replace(/[^\w\s.()&,-]+/g, '_').trim().slice(0, 150);
    return `${base || 'Results'}.xlsx`;
};

/** Accepts "a@x.com, b@y.com" (as the UI sends) or an array. Returns null if any entry is invalid. */
const parseRecipients = (to) => {
    const list = (Array.isArray(to) ? to : String(to || '').split(/[,;]/))
        .map((e) => String(e).trim())
        .filter(Boolean);
    if (list.length === 0 || list.length > MAX_RECIPIENTS) return null;
    return list.every((e) => validator.isEmail(e)) ? [...new Set(list.map((e) => e.toLowerCase()))] : null;
};

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

            const recipients = parseRecipients(to);
            if (!recipients) {
                return res.status(400).json({
                    success: false,
                    message: `Provide between 1 and ${MAX_RECIPIENTS} valid email addresses, separated by commas`
                });
            }
            if (typeof subject !== 'string' || subject.length > MAX_SUBJECT_LENGTH) {
                return res.status(400).json({ success: false, message: `Subject must be at most ${MAX_SUBJECT_LENGTH} characters` });
            }
            if (typeof excelBuffer !== 'string' || !validator.isBase64(excelBuffer)) {
                return res.status(400).json({ success: false, message: 'Attachment content must be base64-encoded' });
            }
            const updatesResultsSent = Array.isArray(studentIds) && studentIds.length > 0;
            if (updatesResultsSent && !RESULTS_SENT_ROLES.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Your role can send results emails but cannot update students\' results-sent dates'
                });
            }

            // Send email with attachment
            const emailResult = await emailService.sendResultsEmail({
                to: recipients.join(', '),
                subject,
                message,
                schoolName,
                academicYear,
                studentCount,
                excelBuffer,
                fileName: safeXlsxName(fileName)
            });

            // Update results sent date for all students if studentIds provided
            if (updatesResultsSent) {
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

            await prisma.userActivity.create({
                data: {
                    userId: req.user.id,
                    action: 'Sent Results Email',
                    entityType: 'Email',
                    entityId: req.user.id,
                    details: JSON.stringify({
                        recipients,
                        subject,
                        schoolName,
                        academicYear,
                        studentCount,
                        fileName,
                        resultsSentUpdatedFor: updatesResultsSent ? studentIds.length : 0,
                    }),
                    ipAddress: req.headers['x-client-ip'] || req.ip || 'Unknown',
                    deviceId: req.headers['x-device-id'] || 'Unknown',
                    browserAgent: req.headers['user-agent'] || 'Unknown',
                },
            }).catch((error) => console.error('Failed to log results email activity:', error?.message));

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