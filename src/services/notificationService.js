import nodemailer from 'nodemailer';
import {prisma} from '@/lib/prisma';
import {scheduleJob, cancelJob} from 'node-schedule';

class NotificationService {
    constructor() {
        this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        this.activeJobs = new Map();
    }

    // Schedule a new notification
    async scheduleNotification(
        {
            type,
            title,
            message,
            recipientId,
            scheduledFor,
            metadata = {}
        }
    ){
        try {
            const notification = await prisma.notification.create({
                data: {
                    type,
                    title,
                    message,
                    recipientId,
                    scheduledFor,
                    metadata
                }
            });
            
            this.scheduleJob(notification);
            return notification;
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
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
            include: { recipient: true }
        });

        if (!notification || notification.status === 'SENT') {
            return;
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
                    status: 'SENT',
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
        await this.emailTransporter.sendMail({
            to: notification.recipient.email,
            subject: notification.title,
            html: this.generateEmailTemplate(notification),
        });
    }

    // Generate email template
    generateEmailTemplate(notification) {
        // You can use a template engine like handlebars here
        return `
            <div style="font-family: Arial, sans-serif;">
                <h2>${notification.title}</h2>
                <p>${notification.message}</p>
                ${notification.metadata.additionalContent || ''}
            </div>
        `;
    }

    // Handle notification errors
    async handleNotificationError(notification, error) {
        const maxRetries = 3;
        const retryCount = notification.retryCount + 1;

        if (retryCount <= maxRetries) {
            // Schedule retry after exponential backoff
            const retryDelay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            const nextRetry = new Date(Date.now() + retryDelay);

            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    retryCount,
                    scheduledFor: nextRetry,
                    error: error.message
                }
            });

            this.scheduleJob({
                ...notification,
                scheduledFor: nextRetry
            });
        } else {
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    status: 'FAILED',
                    error: error.message
                }
            });
        }
    }

    // Initialize scheduled notifications on server start
    async initializeScheduledNotifications() {
        const pendingNotifications = await prisma.notification.findMany({
            where: {
                status: 'PENDING',
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
                status: 'CANCELLED'
            }
        });
    }
}

export const notificationService = new NotificationService();