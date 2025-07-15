import nodemailer from 'nodemailer';

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODE_MAILER_USERCRED,
                pass: process.env.NODE_MAILER_PASSCRED,
            },
        });
    }

    // Send results email with Excel attachment
    async sendResultsEmail({
        to,
        subject,
        message,
        schoolName,
        academicYear,
        studentCount,
        excelBuffer,
        fileName
    }) {
        try {
            const emailTemplate = this.generateResultsEmailTemplate({
                schoolName,
                academicYear,
                studentCount,
                message
            });

            const mailOptions = {
                from: process.env.NODE_MAILER_USERCRED,
                to: to,
                subject: subject,
                html: emailTemplate,
                attachments: [
                    {
                        filename: fileName,
                        content: excelBuffer,
                        encoding: 'base64',
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                ]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Results email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending results email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    // Generate HTML email template for results
    generateResultsEmailTemplate({ schoolName, academicYear, studentCount, message }) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UMI Results</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    margin: 0;
                    padding: 0;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background-color: #ffffff;
                }
                .header { 
                    background-color: #003366; 
                    color: white; 
                    padding: 20px; 
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .content { 
                    padding: 30px 20px; 
                    background-color: #f9f9f9; 
                }
                .footer { 
                    font-size: 12px; 
                    color: #666; 
                    padding: 20px; 
                    text-align: center; 
                    background-color: #f0f0f0;
                }
                .info-box {
                    background-color: #e8f4fd;
                    border-left: 4px solid #003366;
                    padding: 15px;
                    margin: 20px 0;
                }
                .attachment-info {
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 4px;
                    padding: 15px;
                    margin: 20px 0;
                }
                .attachment-info strong {
                    color: #856404;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>UGANDA MANAGEMENT INSTITUTE</h1>
                </div>
                <div class="content">
                    <p>Dear ${schoolName},</p>
                    
                    ${message ? `<p>${message}</p>` : ''}
                    
                    <div class="info-box">
                        <p><strong>School:</strong> ${schoolName}</p>
                        <p><strong>Academic Year:</strong> ${academicYear || 'N/A'}</p>
                        <p><strong>Total Students:</strong> ${studentCount}</p>
                    </div>
                    
                    <p>Please find attached the provisional dissertation examination results for your school.</p>
                    
                    <div class="attachment-info">
                        <p><strong>📎 Attachment:</strong> ${schoolName}_Results_${academicYear || 'N/A'}.xlsx</p>
                        <p>This Excel file contains the complete results breakdown for all students in your school.</p>
                    </div>
                    
                    <p>If you have any questions or need clarification about the results, please don't hesitate to contact us.</p>
                    
                    <p>Best regards,<br>
                    <strong>UMI Research Management Team</strong></p>
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

    // Test email connection
    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('Email service connection verified successfully');
            return true;
        } catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }

    // Send direct message notification email
    async sendMessageNotificationEmail({
        to,
        recipientName,
        senderName,
        messageText,
        conversationUrl
    }) {
        try {
            const emailTemplate = this.generateMessageNotificationTemplate({
                recipientName,
                senderName,
                messageText,
                conversationUrl
            });

            const mailOptions = {
                from: process.env.NODE_MAILER_USERCRED,
                to: to,
                subject: `New message from ${senderName}`,
                html: emailTemplate
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Message notification email sent successfully:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Error sending message notification email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    // Generate email template for message notifications
    generateMessageNotificationTemplate({ recipientName, senderName, messageText, conversationUrl }) {
        // Truncate message text if it's too long
        const truncatedMessage = messageText.length > 200 ? messageText.substring(0, 200) + '...' : messageText;
        
        return `
            <html>
                <head>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            line-height: 1.6; 
                            color: #333; 
                            margin: 0; 
                            padding: 0; 
                            background-color: #f4f4f4; 
                        }
                        .container { 
                            max-width: 600px; 
                            margin: 0 auto; 
                            background-color: #fff; 
                            border-radius: 8px; 
                            overflow: hidden; 
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                        }
                        .header { 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 20px; 
                            text-align: center; 
                        }
                        .header h2 { 
                            margin: 0; 
                            font-size: 24px; 
                        }
                        .content { 
                            padding: 30px; 
                        }
                        .message-preview { 
                            background-color: #f8f9fa; 
                            border-left: 4px solid #667eea; 
                            padding: 15px; 
                            margin: 20px 0; 
                            border-radius: 4px; 
                        }
                        .cta-button { 
                            display: inline-block; 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 12px 30px; 
                            text-decoration: none; 
                            border-radius: 25px; 
                            font-weight: bold; 
                            margin: 20px 0; 
                            text-align: center; 
                        }
                        .footer { 
                            background-color: #f8f9fa; 
                            padding: 20px; 
                            text-align: center; 
                            font-size: 12px; 
                            color: #666; 
                        }
                        .logo {
                            width: 40px;
                            height: 40px;
                            margin: 0 auto 10px;
                            background-color: rgba(255,255,255,0.2);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">📨</div>
                            <h2>New Message Received</h2>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${recipientName}</strong>,</p>
                            
                            <p>You have received a new message from <strong>${senderName}</strong>:</p>
                            
                            <div class="message-preview">
                                <p style="margin: 0; font-style: italic;">"${truncatedMessage}"</p>
                            </div>
                            
                            <p>Click the button below to view and reply to this message:</p>
                            
                            <div style="text-align: center;">
                                <a href="${conversationUrl || '#'}" class="cta-button">View Message</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #666; margin-top: 30px;">
                                You're receiving this email because you have a message waiting in your UMI Research Management System account. 
                                If you don't want to receive these notifications, you can adjust your notification preferences in your account settings.
                            </p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message from UMI Research Management System.</p>
                            <p>&copy; ${new Date().getFullYear()} UMI Research Management System. All rights reserved.</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
    }
}

export default new EmailService(); 