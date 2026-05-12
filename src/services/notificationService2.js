import axios from 'axios';
import prisma from '../utils/db.mjs';
import { scheduleJob, cancelJob } from 'node-schedule';

class NotificationService {
    constructor() {
        // Netlify function configuration
        this.netlifyFunctionUrl = process.env.NETLIFY_FUNCTION_URL;
        this.apiKey = process.env.NETLIFY_API_KEY;

        this.activeJobs = new Map();
    }

    // Core method to send email via Netlify Function
    async sendViaNetlifyFunction(emailData) {
        try {
            const response = await axios.post(this.netlifyFunctionUrl, emailData, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                timeout: 30000, // 30 second timeout
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to send email');
            }

            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data?.error || error.response.data?.message || 'Unknown error';
                throw new Error(`Netlify Function Error (${error.response.status}): ${errorMessage}`);
            } else if (error.request) {
                throw new Error('No response received from Netlify Function. Please check your network connection and function URL.');
            } else {
                throw new Error(`Request setup error: ${error.message}`);
            }
        }
    }

    // Schedule a new notification with recipient type handling
    async scheduleNotification({
        type,
        statusType,
        title,
        message,
        recipientCategory,
        recipientId,
        recipientEmail,
        recipientName,
        scheduledFor,
        metadata = {},
        studentStatus = null
    }) {
        try {
            // Validate and get recipient details based on type
            const recipientDetails = await this.getRecipientDetails(
                recipientCategory,
                recipientId,
                recipientEmail,
                recipientName
            );

            const notificationData = {
                type,
                statusType,
                title,
                message,
                recipientCategory,
                recipientEmail: recipientDetails.email,
                recipientName: recipientDetails.name,
                scheduledFor,
                metadata,
                retryCount: 0
            };

            // Connect to the appropriate recipient based on category
            if (recipientCategory === 'USER' && recipientDetails.id) {
                notificationData.user = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'STUDENT' && recipientDetails.id) {
                notificationData.student = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'EXAMINER' && recipientDetails.id) {
                notificationData.examiner = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'CHAIRPERSON' && recipientDetails.id) {
                notificationData.chairperson = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'MINUTES_SECRETARY' && recipientDetails.id) {
                notificationData.minutesSecretary = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'REVIEWER' && recipientDetails.id) {
                notificationData.reviewer = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'PANELIST' && recipientDetails.id) {
                notificationData.panelist = { connect: { id: recipientDetails.id } };
            } else if (recipientCategory === 'SUPERVISOR' && recipientDetails.id) {
                notificationData.supervisor = { connect: { id: recipientDetails.id } };
            }

            // Add studentStatus connection if provided
            if (studentStatus) {
                notificationData.studentStatus = studentStatus;
            }

            const notification = await prisma.notification.create({
                data: notificationData
            });

            this.scheduleJob(notification);
            return notification;
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
    }

    // Get recipient details based on type
    async getRecipientDetails(type, id, email, name) {
        if (type === 'EXTERNAL') {
            if (!email || !name) {
                throw new Error('Email and name are required for external recipients');
            }
            return { id: null, email, name };
        }

        let recipient;
        switch (type) {
            case 'USER':
                recipient = await prisma.user.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.email,
                        name: recipient.name
                    };
                }
                break;
            case 'STUDENT':
                recipient = await prisma.student.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.email,
                        name: `${recipient.fullName}`
                    };
                }
                break;
            case 'EXAMINER':
                recipient = await prisma.examiner.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.primaryEmail || recipient.secondaryEmail,
                        name: recipient.name
                    };
                }
                break;
            case 'SUPERVISOR':
                recipient = await prisma.supervisor.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.workEmail || recipient.personalEmail,
                        name: recipient.name
                    };
                }
                break;
            case 'PANELIST':
                recipient = await prisma.panelist.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.email,
                        name: recipient.name
                    };
                }
                break;
            case 'REVIEWER':
                recipient = await prisma.reviewer.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.email,
                        name: recipient.name
                    };
                }
                break;
            case 'CHAIRPERSON':
                // Assuming chairperson is a facultyMember
                recipient = await prisma.facultyMember.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.workEmail,
                        name: recipient.name
                    };
                }
                break;
            case 'MINUTES_SECRETARY':
                // Assuming minutes secretary is an ExternalPerson
                recipient = await prisma.externalPerson.findUnique({ where: { id } });
                if (recipient) {
                    return {
                        id: recipient.id,
                        email: recipient.email,
                        name: recipient.name
                    };
                }
                break;
        }

        if (!recipient) {
            throw new Error(`Recipient not found: ${type} ${id}`);
        }

        return {
            id: recipient.id,
            email: recipient.email,
            name: recipient.name
        };
    }

    // Schedule a job for a notification
    scheduleJob(notification) {
        const job = scheduleJob(notification.scheduledFor, async () => {
            await this.sendNotification(notification.id);
        });

        this.activeJobs.set(notification.id, job);
    }

    // Send a notification
    async sendNotification(notificationId) {
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
            include: {
                studentStatus: true
            }
        });

        if (!notification || notification.statusType === 'SENT') {
            return;
        }

        // Check if the notification is related to a student status and if that status is still current
        if (notification.studentStatus) {
            const currentStatus = await prisma.studentStatus.findUnique({
                where: { id: notification.studentStatus.id }
            });

            if (!currentStatus || !currentStatus.isCurrent) {
                console.log(`Skipping notification ${notificationId} because the student status is no longer current`);
                await prisma.notification.update({
                    where: { id: notificationId },
                    data: {
                        statusType: 'CANCELLED',
                        error: 'Student status is no longer current'
                    }
                });
                this.activeJobs.delete(notificationId);
                return;
            }
        }

        try {
            switch (notification.type) {
                case 'EMAIL':
                    await this.sendEmail(notification);
                    break;
                case 'SYSTEM':
                    await this.sendSystemNotification(notification);
                    break;
                case 'REMINDER':
                    await this.sendReminder(notification);
                    break;
            }

            await prisma.notification.update({
                where: { id: notificationId },
                data: {
                    statusType: 'SENT',
                    sentAt: new Date()
                }
            });

            this.activeJobs.delete(notificationId);
        } catch (error) {
            console.error('Error sending notification:', error);
            await this.handleNotificationError(notification, error);
        }
    }

    // Send email notification via Netlify Function
    async sendEmail(notification) {
        const template = this.generateEmailTemplate(notification);

        const emailData = {
            to: notification.recipientEmail,
            subject: notification.title,
            html: template
        };

        await this.sendViaNetlifyFunction(emailData);
    }

    // Send system notification
    async sendSystemNotification(notification) {
        // Implementation for system notifications
        console.log(`System notification sent to ${notification.recipientName}: ${notification.title}`);
    }

    // Send reminder notification via Netlify Function
    async sendReminder(notification) {
        const template = this.generateEmailTemplate(notification);

        const emailData = {
            to: notification.recipientEmail,
            subject: `REMINDER: ${notification.title}`,
            html: template
        };

        await this.sendViaNetlifyFunction(emailData);
    }

    // Get base email template
    getBaseTemplate() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{{title}}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .header { background-color: #003366; color: white; padding: 20px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 30px 20px; background-color: #f9f9f9; }
                .footer { font-size: 12px; color: #666; padding: 20px; text-align: center; background-color: #f0f0f0; }
                .info-box { background-color: #e8f4fd; border-left: 4px solid #003366; padding: 15px; margin: 20px 0; }
                .button { display: inline-block; background-color: #003366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>UGANDA MANAGEMENT INSTITUTE</h1>
                </div>
                <div class="content">
                    <p>Dear {{recipientName}},</p>
                    {{content}}
                </div>
                <div class="footer">
                    <p>This is an automated message from the UMI Research Management System.</p>
                    <p>© ${new Date().getFullYear()} Uganda Management Institute. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate content template based on notification type
    getContentTemplate(notification) {
        let content = `<p>${notification.message}</p>`;

        // Add metadata-specific content
        if (notification.metadata.additionalContent) {
            content += notification.metadata.additionalContent;
        }

        // Add action buttons if needed
        if (notification.metadata.actionUrl) {
            content += `<p><a href="${notification.metadata.actionUrl}" class="button">Take Action</a></p>`;
        }

        return content;
    }

    // Generate email template
    generateEmailTemplate(notification) {
        const baseTemplate = this.getBaseTemplate();
        const contentTemplate = this.getContentTemplate(notification);

        return baseTemplate
            .replace(/{{title}}/g, notification.title)
            .replace(/{{recipientName}}/g, notification.recipientName)
            .replace(/{{content}}/g, contentTemplate);
    }

    // Handle notification errors
    async handleNotificationError(notification, error) {
        const maxRetries = 3;
        const retryCount = notification.retryCount || 0;
        const newRetryCount = retryCount + 1;

        if (newRetryCount <= maxRetries) {
            // Schedule retry after exponential backoff
            const retryDelay = Math.pow(2, newRetryCount) * 1000; // 2s, 4s, 8s
            const nextRetry = new Date(Date.now() + retryDelay);

            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    retryCount: newRetryCount,
                    scheduledFor: nextRetry,
                    error: error.message
                }
            });

            this.scheduleJob({
                ...notification,
                retryCount: newRetryCount,
                scheduledFor: nextRetry
            });
        } else {
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    statusType: 'FAILED',
                    error: error.message
                }
            });
        }
    }

    // Initialize scheduled notifications on server start
    async initializeScheduledNotifications() {
        const pendingNotifications = await prisma.notification.findMany({
            where: {
                statusType: 'PENDING'
            }
        });

        const now = new Date();
        for (const notification of pendingNotifications) {
            const scheduledTime = new Date(notification.scheduledFor);
            
            if (scheduledTime <= now) {
                // If the scheduled time has already passed (server was down), send it immediately
                console.log(`Processing missed notification window for: ${notification.id} (Scheduled for: ${notification.scheduledFor})`);
                await this.sendNotification(notification.id);
            } else {
                // Schedule for the future
                this.scheduleJob(notification);
            }
        }
    }

    // Cancel and delete all notifications for a specific student
    // This also cleans up notifications linked to the student's statuses
    // (e.g. notifications sent to supervisors/examiners about this student)
    async cancelNotificationsByStudent(studentId) {
        try {
            // 1. Get all studentStatus IDs for this student
            const studentStatuses = await prisma.studentStatus.findMany({
                where: { studentId: studentId },
                select: { id: true }
            });
            const statusIds = studentStatuses.map(s => s.id);

            // 2. Find ALL pending notifications linked to this student
            //    either directly via studentId OR via any of their studentStatusIds
            const pendingNotifications = await prisma.notification.findMany({
                where: {
                    statusType: 'PENDING',
                    OR: [
                        { studentId: studentId },
                        ...(statusIds.length > 0 ? [{ studentStatusId: { in: statusIds } }] : [])
                    ]
                }
            });

            // 3. Cancel all in-memory scheduled jobs
            for (const notification of pendingNotifications) {
                const job = this.activeJobs.get(notification.id);
                if (job) {
                    job.cancel();
                    this.activeJobs.delete(notification.id);
                }
            }

            // 4. Delete ALL notifications linked to this student (any status, not just PENDING)
            const deleted = await prisma.notification.deleteMany({
                where: {
                    OR: [
                        { studentId: studentId },
                        ...(statusIds.length > 0 ? [{ studentStatusId: { in: statusIds } }] : [])
                    ]
                }
            });

            console.log(`Cleaned up ${deleted.count} notifications for student ${studentId} (including ${statusIds.length} status-linked sets)`);
        } catch (error) {
            console.error(`Error cleaning up notifications for student ${studentId}:`, error);
        }
    }

    // Cancel all pending notifications for a specific student status
    async cancelNotificationsByStatus(studentStatusId) {
        try {
            const notifications = await prisma.notification.findMany({
                where: {
                    studentStatusId: studentStatusId,
                    statusType: 'PENDING'
                }
            });

            for (const notification of notifications) {
                await this.cancelNotification(notification.id);
            }
            console.log(`Cancelled ${notifications.length} pending notifications for status ${studentStatusId}`);
        } catch (error) {
            console.error(`Error cancelling notifications for status ${studentStatusId}:`, error);
        }
    }

    // Cancel a scheduled notification
    async cancelNotification(notificationId) {
        const job = this.activeJobs.get(notificationId);
        if (job) {
            job.cancel();
            this.activeJobs.delete(notificationId);
        }

        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                statusType: 'CANCELLED'
            }
        });
    }

    // Test Netlify function connection
    async testConnection() {
        try {
            const testData = {
                to: process.env.TEST_EMAIL || 'test@example.com',
                subject: 'Notification Service Test',
                text: 'This is a test email to verify Netlify Function connectivity for notifications.',
                html: '<p>This is a test email to verify Netlify Function connectivity for notifications.</p>'
            };

            const response = await this.sendViaNetlifyFunction(testData);
            console.log('Notification Service - Netlify Function connection verified successfully:', response);
            return true;
        } catch (error) {
            console.error('Notification Service - Netlify Function connection failed:', error.message);
            return false;
        }
    }

    // Example usage for different scenarios
    async scheduleVivaNotifications(viva) {
        // Notify student
        await this.scheduleNotification({
            type: 'EMAIL',
            statusType: 'PENDING',
            title: 'Viva Scheduled',
            message: `Your viva has been scheduled for ${viva.date}`,
            recipientCategory: 'STUDENT',
            recipientId: viva.studentId,
            scheduledFor: new Date(),
            metadata: {
                vivaId: viva.id,
                additionalContent: `<p>Your viva voce examination has been scheduled. Please ensure you are prepared.</p>
                                  <p><strong>Date:</strong> ${viva.date}</p>
                                  <p><strong>Venue:</strong> ${viva.venue || 'To be announced'}</p>`
            }
        });

        // Notify examiners
        for (const examiner of viva.examiners) {
            await this.scheduleNotification({
                type: 'EMAIL',
                statusType: 'PENDING',
                title: 'Viva Examination Schedule',
                message: `You have been scheduled to examine a viva on ${viva.date}`,
                recipientCategory: 'EXAMINER',
                recipientId: examiner.id,
                scheduledFor: new Date(),
                metadata: {
                    vivaId: viva.id,
                    role: examiner.role,
                    additionalContent: `<p>You have been assigned as ${examiner.role} for a viva voce examination.</p>
                                      <p><strong>Date:</strong> ${viva.date}</p>
                                      <p><strong>Student:</strong> ${viva.studentName}</p>
                                      <p><strong>Venue:</strong> ${viva.venue || 'To be announced'}</p>`
                }
            });
        }

        // Notify external participants if any
        if (viva.externalParticipants) {
            for (const participant of viva.externalParticipants) {
                await this.scheduleNotification({
                    type: 'EMAIL',
                    statusType: 'PENDING',
                    title: 'Viva Examination Invitation',
                    message: `You have been invited to participate in a viva examination`,
                    recipientCategory: 'EXTERNAL',
                    recipientEmail: participant.email,
                    recipientName: participant.name,
                    scheduledFor: new Date(),
                    metadata: {
                        vivaId: viva.id,
                        role: participant.role,
                        additionalContent: `<p>You have been invited to participate in a viva voce examination as ${participant.role}.</p>
                                          <p><strong>Date:</strong> ${viva.date}</p>
                                          <p><strong>Student:</strong> ${viva.studentName}</p>
                                          <p><strong>Venue:</strong> ${viva.venue || 'To be announced'}</p>`
                    }
                });
            }
        }
    }

    // Schedule bulk notifications
    async scheduleBulkNotifications(notifications) {
        return Promise.all(
            notifications.map(notification => this.scheduleNotification(notification))
        );
    }

    // Send immediate notification (bypass scheduling)
    async sendImmediateNotification(notificationData) {
        try {
            const recipientDetails = await this.getRecipientDetails(
                notificationData.recipientCategory,
                notificationData.recipientId,
                notificationData.recipientEmail,
                notificationData.recipientName
            );

            const template = this.generateEmailTemplate({
                ...notificationData,
                recipientName: recipientDetails.name
            });

            const emailData = {
                to: recipientDetails.email,
                subject: notificationData.title,
                html: template
            };

            const result = await this.sendViaNetlifyFunction(emailData);
            console.log('Immediate notification sent successfully:', result);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending immediate notification:', error);
            throw error;
        }
    }

    // Start the cron job for workflow escalations
    // DEPRECATED: This logic is now handled by proactive scheduled notifications in 
    // managementController.js (registerStudent and assignSupervisorsToStudent)
    startWorkflowEscalationCron() {
        console.log('Workflow Escalation Cron is DEPRECATED and disabled.');
        // Logic is now handled by targeted scheduled notifications
    }

    // Start global student deadline monitor (Daily at 1 AM)
    startStudentDeadlineMonitor() {
        console.log('Initializing Student Deadline Monitor (Daily at 1 AM)');

        scheduleJob('0 1 * * *', async () => {
            try {
                console.log('Running Student Deadline Check...');
                const now = new Date();
                
                // Only monitor active students with an expected completion date
                const students = await prisma.student.findMany({
                    where: {
                        isActive: true,
                        expectedCompletionDate: { not: null },
                        admissionDate: { not: null }
                    }
                });

                for (const student of students) {
                    const admissionDate = new Date(student.admissionDate);
                    const expectedDate = new Date(student.expectedCompletionDate);
                    
                    const totalDurationMs = expectedDate.getTime() - admissionDate.getTime();
                    const halfwayDate = new Date(admissionDate.getTime() + totalDurationMs / 2);
                    
                    // 1. Halfway Warning
                    if (this.isSameDay(now, halfwayDate)) {
                        await this.sendDeadlineWarning(student, 'HALFWAY', `You are halfway through your research timeline. Keep up the good work!`);
                    }

                    // 2. 6 Months Remaining
                    const sixMonthsBefore = new Date(expectedDate);
                    sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
                    if (this.isSameDay(now, sixMonthsBefore)) {
                        await this.sendDeadlineWarning(student, '6_MONTH_WARNING', `Your research completion deadline is in 6 months (${expectedDate.toDateString()}).`);
                    }

                    // 3. 1 Month Remaining
                    const oneMonthBefore = new Date(expectedDate);
                    oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
                    if (this.isSameDay(now, oneMonthBefore)) {
                        await this.sendDeadlineWarning(student, '1_MONTH_CRITICAL', `URGENT: Your research completion deadline is in only 1 month (${expectedDate.toDateString()}).`);
                    }
                }
            } catch (error) {
                console.error('Error in student deadline monitor:', error);
            }
        });
    }

    // Helper to check if two dates are the same day
    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    // Send warning email to student
    async sendDeadlineWarning(student, type, message) {
        // Check if we already sent this type of warning recently to avoid duplicates
        const existing = await prisma.notification.findFirst({
            where: {
                recipientId: student.id,
                title: { contains: 'Research Deadline' },
                metadata: {
                    path: ['warningType'],
                    equals: type
                }
            }
        });

        if (!existing) {
            await this.scheduleNotification({
                type: 'EMAIL',
                statusType: 'PENDING',
                title: `Research Deadline Warning - ${type.replace(/_/g, ' ')}`,
                message: `Dear ${student.fullName}, \n\n${message}\n\nPlease ensure you are on track with your research milestones.`,
                recipientCategory: 'STUDENT',
                recipientId: student.id,
                recipientEmail: student.email,
                recipientName: student.fullName,
                scheduledFor: new Date(),
                metadata: {
                    warningType: type,
                    expectedCompletionDate: student.expectedCompletionDate
                }
            });
        }
    }
}

export const notificationService = new NotificationService();