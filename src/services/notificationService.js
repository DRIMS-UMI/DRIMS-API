import axios from 'axios';
import prisma from '../utils/db.mjs';
import {scheduleJob, cancelJob} from 'node-schedule';

class NotificationService {
    constructor() {
        this.zohoApiUrl = 'https://mail.zoho.com/api/accounts';
        this.accountId = process.env.ZOHO_ACCOUNT_ID;
        this.fromEmail = process.env.ZOHO_EMAIL_USER;
        
        // Don't set a static access token - we'll get it dynamically
        this.accessToken = null;
        
        // Create axios instance for Zoho API (without authorization header initially)
        this.apiClient = axios.create({
            baseURL: this.zohoApiUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.activeJobs = new Map();
    }

    // Get fresh Zoho access token
    static async getZohoAccessToken() {
        try {
            const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
                params: {
                    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
                    client_id: process.env.ZOHO_CLIENT_ID,
                    client_secret: process.env.ZOHO_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                },
            });
            return res.data.access_token;
        } catch (error) {
            console.error('Failed to refresh Zoho access token:', error?.response?.data || error.message);
            throw new Error('Failed to refresh Zoho access token');
        }
    }

    // Refresh access token
    async refreshAccessToken() {
        try {
            const newAccessToken = await NotificationService.getZohoAccessToken();
            this.accessToken = newAccessToken;
            
            // Update the authorization header
            this.apiClient.defaults.headers['Authorization'] = `Zoho-oauthtoken ${this.accessToken}`;
            
            console.log('Notification service access token refreshed successfully');
            return newAccessToken;
        } catch (error) {
            console.error('Error refreshing notification service access token:', error.message);
            throw error;
        }
    }

    // Enhanced send method with automatic token refresh on 401 errors
    async sendEmailWithRetry(emailData) {
        try {
            // If we don't have a token yet, get one first
            if (!this.accessToken) {
                await this.refreshAccessToken();
            }

            const response = await this.apiClient.post(`/${this.accountId}/messages`, emailData);
            return response;
        } catch (error) {
            // If we get an unauthorized error, try refreshing the token and retry once
            if (error.response?.status === 401) {
                console.log('Access token expired or invalid, refreshing...');
                await this.refreshAccessToken();
                
                // Retry the request with the new token
                const response = await this.apiClient.post(`/${this.accountId}/messages`, emailData);
                return response;
            }
            throw error;
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
                        name: `${recipient.firstName} ${recipient.lastName}`
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

    // Send email notification
    async sendEmail(notification) {
        const template = this.generateEmailTemplate(notification);
        
        const emailData = {
            fromAddress: this.fromEmail,
            toAddress: "stephaniekirathe@gmail.com", // notification.recipientEmail,
            subject: notification.title,
            content: template
        };

        await this.sendEmailWithRetry(emailData);
    }

    // Send system notification
    async sendSystemNotification(notification) {
        // Implementation for system notifications
        console.log(`System notification sent to ${notification.recipientName}: ${notification.title}`);
    }

    // Send reminder notification
    async sendReminder(notification) {
        // Implementation for reminder notifications
        const template = this.generateEmailTemplate(notification);
        
        const emailData = {
            fromAddress: this.fromEmail,
            toAddress: notification.recipientEmail,
            subject: `REMINDER: ${notification.title}`,
            content: template
        };

        await this.sendEmailWithRetry(emailData);
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
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #003366; color: white; padding: 10px 20px; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .footer { font-size: 12px; color: #666; padding: 10px 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{{title}}</h1>
                </div>
                <div class="content">
                    <p>Dear {{recipientName}},</p>
                    <p>{{message}}</p>
                    {{content}}
                </div>
                <div class="footer">
                    <p>This is an automated message from the UMI Research Management System.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate content template based on notification type
    getContentTemplate(notification) {
        // Default content
        return `<p>${notification.message}</p>
                ${notification.metadata.additionalContent || ''}`;
    }

    // Generate email template
    generateEmailTemplate(notification) {
        // Get base template
        const baseTemplate = this.getBaseTemplate();
        
        // Replace placeholders with actual content
        return baseTemplate
            .replace(/{{title}}/g, notification.title)
            .replace(/{{recipientName}}/g, notification.recipientName)
            .replace(/{{message}}/g, notification.message)
            .replace(/{{content}}/g, notification.metadata.additionalContent || '');
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
                statusType: 'PENDING',
                scheduledFor: {
                    gte: new Date()
                }
            }
        });

        pendingNotifications.forEach(notification => {
            this.scheduleJob(notification);
        });
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
            metadata: { vivaId: viva.id }
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
                metadata: { vivaId: viva.id, role: examiner.role }
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
                    metadata: { vivaId: viva.id, role: participant.role }
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
}

export const notificationService = new NotificationService();