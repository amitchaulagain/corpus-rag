// Email service for sending password reset emails
import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private appUrl: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@example.com';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Initialize transporter if email config is provided
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const config: EmailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      };

      this.transporter = nodemailer.createTransport(config);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Email service not configured. Password reset link:');
      console.log(`${this.appUrl}/reset-password?token=${resetToken}`);
      console.log('\nTo enable email sending, add these to your .env:');
      console.log('EMAIL_HOST=smtp.gmail.com');
      console.log('EMAIL_PORT=587');
      console.log('EMAIL_SECURE=false');
      console.log('EMAIL_USER=your-email@gmail.com');
      console.log('EMAIL_PASS=your-app-password');
      console.log('EMAIL_FROM=noreply@yourdomain.com');
      console.log('APP_URL=http://localhost:3000');
      return;
    }

    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: this.fromEmail,
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the link below to proceed:</p>
          <p>
            <a href="${resetUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6B7280; word-break: break-all;">${resetUrl}</p>
          <p style="color: #EF4444; font-size: 14px;">
            ⚠️ This link will expire in 1 hour.
          </p>
          <p style="color: #6B7280; font-size: 14px;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      text: `
Password Reset Request

You requested to reset your password. Click the link below to proceed:

${resetUrl}

⚠️ This link will expire in 1 hour.

If you didn't request this, please ignore this email.
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${to}`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
}

export const emailService = new EmailService();
