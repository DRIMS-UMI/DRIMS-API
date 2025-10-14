import axios from 'axios';

class EmailService {
    constructor () {
        // Netlify function URL - update with your actual Netlify site URL
        this.netlifyFunctionUrl = process.env.NETLIFY_FUNCTION_URL || 'https://your-site.netlify.app/.netlify/functions/email-service';
        this.apiKey = process.env.NETLIFY_API_KEY;
    }

    // Send results email with Excel attachment via Netlify Function
    async sendResultsEmail({
        to,
        subject,
        message,
        schoolName,
        academicYear,
        studentCount,
        excelBuffer,
        fileName
    }){
        try {
            const emailTemplate = this.generateResultsEmailTemplate({
                schoolName,
                academicYear,
                studentCount,
                message
            });

            const emailData = {
                to: to,
                subject: subject,
                html: emailTemplate,
                attachments: [
                    {
                        filename: fileName,
                        content: excelBuffer.toString('base64'),
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        encoding: 'base64'
                    }
                ]
            };

            const response = await this.sendViaNetlifyFunction(emailData);

            console.log('Results email sent successfully via Netlify Function:', response);

            return { success: true, messageId: response.messageId };
        } catch (error) {
            console.error('Error sending results email via Netlify Functions:',error.response?.data || error.message )
            throw new Error(`Failed to send email: ${error.response?.data?.error || error.message}`);
        }
    }

    // Send direct message notification email via Netlify Function
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

            const emailData = {
                to: to,
                subject: `New message from ${senderName}`,
                html: emailTemplate
            };

            const response = await this.sendViaNetlifyFunction(emailData);
            console.log('Message notification email sent successfully via Netlify Function:', response);
            return { success: true, messageId: response.messageId };
        } catch (error) {
            console.error('Error sending message notification email via Netlify Function:', error.response?.data || error.message);
            throw new Error(`Failed to send email: ${error.response?.data?.error || error.message}`);
        }
    }

    // Send basic email using Netlify Function
    async sendEmail({
        to,
        subject,
        htmlContent,
        textContent,
        attachments = []
    }) {
        try {
            const emailData = {
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                ...(htmlContent && { html: htmlContent }),
                ...(textContent && { text: textContent }),
                ...(attachments.length > 0 && { 
                    attachments: attachments.map(att => ({
                        filename: att.filename || `attachment-${Date.now()}`,
                        content: att.content.toString('base64'),
                        contentType: att.contentType || 'application/octet-stream',
                        encoding: 'base64'
                    }))
                })
            };

            const response = await this.sendViaNetlifyFunction(emailData);
            console.log('Email sent successfully via Netlify Function:', response);
            return { success: true, messageId: response.messageId };
        } catch (error) {
            console.error('Error sending email via Netlify Function:', error.response?.data || error.message);
            throw new Error(`Failed to send email: ${error.response?.data?.error || error.message}`);
        }
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
             // Enhanced error handling
             if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                const errorMessage = error.response.data?.error || error.response.data?.message || 'Unknown error';
                throw new Error(`Netlify Function Error (${error.response.status}): ${errorMessage}`);
            } else if (error.request) {
                // The request was made but no response was received
                throw new Error('No response received from Netlify Function. Please check your network connection and function URL.');
            } else {
                // Something happened in setting up the request that triggered an Error
                throw new Error(`Request setup error: ${error.message}`);
            }
        }
    }

      // Test Netlify function connection
      async testConnection() {
        try {
            // Send a test email to verify connection
            const testData = {
                to: process.env.TEST_EMAIL || 'test@example.com',
                subject: 'Netlify Function Test',
                text: 'This is a test email to verify Netlify Function connectivity.',
                html: '<p>This is a test email to verify Netlify Function connectivity.</p>'
            };

            const response = await this.sendViaNetlifyFunction(testData);
            console.log('Netlify Function connection verified successfully:', response);
            return true;
        } catch (error) {
            console.error('Netlify Function connection failed:', error.message);
            return false;
        }
    }

     // Generate HTML email template for results (keep your existing template)
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

    // Generate email template for message notifications (keep your existing template)
    generateMessageNotificationTemplate({ recipientName, senderName, messageText, conversationUrl }) {
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