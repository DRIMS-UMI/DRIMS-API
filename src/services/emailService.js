import axios from 'axios';

class EmailService {
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

            const emailData = {
                fromAddress: this.fromEmail,
                toAddress: to,
                subject: subject,
                content: emailTemplate,
                attachments: [
                    {
                        attachmentName: fileName,
                        content: excelBuffer.toString('base64'),
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                ]
            };

            const response = await this.sendEmailWithRetry(emailData);
            console.log('Results email sent successfully via Zoho API:', response.data);
            return { success: true, messageId: response.data.data?.messageId };
        } catch (error) {
            console.error('Error sending results email via Zoho API:', error.response?.data || error.message);
            throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
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

            const emailData = {
                fromAddress: this.fromEmail,
                toAddress: to,
                subject: `New message from ${senderName}`,
                content: emailTemplate
            };

            const response = await this.sendEmailWithRetry(emailData);
            console.log('Message notification email sent successfully via Zoho API:', response.data);
            return { success: true, messageId: response.data.data?.messageId };
        } catch (error) {
            console.error('Error sending message notification email via Zoho API:', error.response?.data || error.message);
            throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
        }
    }

    // Send basic email using Zoho Mail API
    async sendEmail({
        to,
        subject,
        htmlContent,
        textContent,
        attachments = []
    }) {
        try {
            const emailData = {
                fromAddress: this.fromEmail,
                toAddress: Array.isArray(to) ? to.join(',') : to,
                subject: subject,
                content: htmlContent || textContent,
                ...(attachments.length > 0 && { attachments })
            };

            const response = await this.sendEmailWithRetry(emailData);
            console.log('Email sent successfully via Zoho API:', response.data);
            return { success: true, messageId: response.data.data?.messageId };
        } catch (error) {
            console.error('Error sending email via Zoho API:', error.response?.data || error.message);
            throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
        }
    }

    // Test email connection by getting account info
    async testConnection() {
        try {
            // Ensure we have a token before testing
            if (!this.accessToken) {
                await this.refreshAccessToken();
            }

            const response = await this.apiClient.get(`/${this.accountId}`);
            console.log('Zoho Mail API connection verified successfully:', response.data);
            return true;
        } catch (error) {
            // Try refreshing token if we get 401
            if (error.response?.status === 401) {
                try {
                    await this.refreshAccessToken();
                    const response = await this.apiClient.get(`/${this.accountId}`);
                    console.log('Zoho Mail API connection verified successfully after token refresh:', response.data);
                    return true;
                } catch (retryError) {
                    console.error('Zoho Mail API connection failed even after token refresh:', retryError.response?.data || retryError.message);
                    return false;
                }
            }
            console.error('Zoho Mail API connection failed:', error.response?.data || error.message);
            return false;
        }
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

    // Refresh access token if needed (improved implementation)
    async refreshAccessToken() {
        try {
            const newAccessToken = await EmailService.getZohoAccessToken();
            this.accessToken = newAccessToken;
            
            // Update the authorization header
            this.apiClient.defaults.headers['Authorization'] = `Zoho-oauthtoken ${this.accessToken}`;
            
            console.log('Access token refreshed successfully');
            return newAccessToken;
        } catch (error) {
            console.error('Error refreshing access token:', error.message);
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