/**
 * Email Utility
 * Service để gửi email qua SMTP (Gmail)
 */

import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Tạo transporter cho nodemailer
 */
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASS || '';

  if (!emailUser || !emailPass) {
    console.warn('[Email] EMAIL_USER or EMAIL_PASS not configured');
    return null;
  }

  return nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

/**
 * Gửi email OTP cho password reset
 * @param email - Email người nhận
 * @param otpCode - Mã OTP 6 chữ số
 * @param username - Tên người dùng (optional)
 */
export async function sendOTPEmail(
  email: string,
  otpCode: string,
  username?: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.error('[Email] Transporter not available');
      return false;
    }

    const mailOptions = {
      from: '"HCMSIU SSPS Support" <project.ssps@gmail.com>',
      to: email,
      subject: 'Mã OTP khôi phục mật khẩu - HCMSIU SSPS',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4f46e5;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              text-align: center;
              letter-spacing: 8px;
              color: #4f46e5;
              background-color: #f3f4f6;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
            .warning {
              color: #dc2626;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>HCMSIU SSPS</h1>
              <p>Khôi phục mật khẩu</p>
            </div>
            <div class="content">
              <p>Xin chào${username ? ` ${username}` : ''},</p>
              
              <p>Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã OTP sau để tiếp tục:</p>
              
              <div class="otp-code">${otpCode}</div>
              
              <p class="warning">⚠️ Mã OTP này chỉ có hiệu lực trong 5 phút.</p>
              
              <p>Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
              
              <p>Trân trọng,<br>Đội ngũ HCMSIU SSPS</p>
            </div>
            <div class="footer">
              <p>Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Xin chào${username ? ` ${username}` : ''},

Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã OTP sau để tiếp tục:

Mã OTP: ${otpCode}

⚠️ Mã OTP này chỉ có hiệu lực trong 5 phút.

Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ HCMSIU SSPS
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] OTP email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('[Email] Error sending OTP email:', error);
    return false;
  }
}

/**
 * Gửi email thông báo đổi mật khẩu thành công
 * @param email - Email người nhận
 * @param username - Tên người dùng (optional)
 */
export async function sendPasswordChangedEmail(
  email: string,
  username?: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.error('[Email] Transporter not available');
      return false;
    }

    const mailOptions = {
      from: '"HCMSIU SSPS Support" <project.ssps@gmail.com>',
      to: email,
      subject: 'Mật khẩu đã được thay đổi - HCMSIU SSPS',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #10b981;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
            .warning {
              color: #dc2626;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Mật khẩu đã được thay đổi</h1>
            </div>
            <div class="content">
              <p>Xin chào${username ? ` ${username}` : ''},</p>
              
              <p>Mật khẩu của bạn đã được thay đổi thành công.</p>
              
              <p class="warning">⚠️ Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ với chúng tôi ngay lập tức.</p>
              
              <p>Trân trọng,<br>Đội ngũ HCMSIU SSPS</p>
            </div>
            <div class="footer">
              <p>Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Xin chào${username ? ` ${username}` : ''},

Mật khẩu của bạn đã được thay đổi thành công.

⚠️ Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ với chúng tôi ngay lập tức.

Trân trọng,
Đội ngũ HCMSIU SSPS
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password changed email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('[Email] Error sending password changed email:', error);
    return false;
  }
}

