import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

# Email configuration from environment
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "DSG Transport LLC")

def is_email_configured():
    """Check if email is properly configured"""
    return all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL])

def send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """Send an email using SMTP"""
    if not is_email_configured():
        print("Email not configured - skipping email send")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        
        # Add plain text and HTML versions
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        # Connect and send
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False

def send_invitation_email(to_email: str, user_name: str, password: str, login_url: str) -> bool:
    """Send invitation email to new user"""
    subject = "🚚 Welcome to DSG Transport Portal - Your Login Credentials"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .credentials {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }}
            .credentials p {{ margin: 10px 0; }}
            .label {{ color: #666; font-size: 14px; }}
            .value {{ font-weight: bold; font-size: 16px; color: #333; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚚 DSG Transport LLC</h1>
                <p>Welcome to the Team!</p>
            </div>
            <div class="content">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your account has been created on the DSG Transport Management Portal. Below are your login credentials:</p>
                
                <div class="credentials">
                    <p><span class="label">Email:</span><br><span class="value">{to_email}</span></p>
                    <p><span class="label">Password:</span><br><span class="value">{password}</span></p>
                </div>
                
                <p><strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.</p>
                
                <center>
                    <a href="{login_url}" class="button">Login to Portal</a>
                </center>
                
                <p>If you have any questions, please contact your administrator.</p>
                
                <div class="footer">
                    <p>This is an automated message from DSG Transport LLC</p>
                    <p>© 2025 DSG Transport LLC. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Welcome to DSG Transport Portal!
    
    Hello {user_name},
    
    Your account has been created. Here are your login credentials:
    
    Email: {to_email}
    Password: {password}
    
    Login at: {login_url}
    
    Please change your password after your first login.
    
    - DSG Transport LLC
    """
    
    return send_email(to_email, subject, html_content, text_content)

def send_password_reset_email(to_email: str, user_name: str, new_password: str, login_url: str) -> bool:
    """Send password reset email"""
    subject = "🔐 DSG Transport Portal - Password Reset"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .credentials {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your password has been reset by an administrator. Your new credentials are:</p>
                
                <div class="credentials">
                    <p><strong>New Password:</strong> {new_password}</p>
                </div>
                
                <p><strong>⚠️ Important:</strong> Please change your password immediately after logging in.</p>
                
                <center>
                    <a href="{login_url}" class="button">Login Now</a>
                </center>
                
                <div class="footer">
                    <p>© 2025 DSG Transport LLC. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Password Reset - DSG Transport Portal
    
    Hello {user_name},
    
    Your password has been reset. Your new password is: {new_password}
    
    Login at: {login_url}
    
    Please change your password immediately after logging in.
    
    - DSG Transport LLC
    """
    
    return send_email(to_email, subject, html_content, text_content)


async def send_otp_email(to_email: str, user_name: str, otp: str) -> bool:
    """Send 2-Step Verification OTP email"""
    subject = "🔐 DSG Transport Portal - Login Verification Code"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .otp-box {{ background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #667eea; }}
            .otp-code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; }}
            .warning {{ background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Login Verification</h1>
                <p>2-Step Verification Code</p>
            </div>
            <div class="content">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>You're trying to sign in to your DSG Transport Portal account. Use this verification code to complete your login:</p>
                
                <div class="otp-box">
                    <p style="margin: 0; color: #666;">Your verification code is:</p>
                    <p class="otp-code">{otp}</p>
                </div>
                
                <div class="warning">
                    <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                        <li>This code will expire in <strong>5 minutes</strong></li>
                        <li>Never share this code with anyone</li>
                        <li>If you didn't request this, please ignore this email</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>This is an automated security message from DSG Transport LLC</p>
                    <p>© 2025 DSG Transport LLC. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Login Verification - DSG Transport Portal
    
    Hello {user_name},
    
    Your verification code is: {otp}
    
    This code will expire in 5 minutes.
    
    If you didn't request this code, please ignore this email.
    
    - DSG Transport LLC
    """
    
    return send_email(to_email, subject, html_content, text_content)



async def send_password_reset_email(to_email: str, user_name: str, new_password: str) -> bool:
    """Send password reset email with new password"""
    subject = "🔑 DSG Transport Portal - Your Password Has Been Reset"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .credential-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #667eea; }}
            .label {{ color: #666; font-size: 12px; text-transform: uppercase; }}
            .value {{ font-size: 18px; font-weight: bold; color: #333; font-family: monospace; letter-spacing: 1px; }}
            .warning {{ background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 Password Reset</h1>
                <p>Your account password has been updated</p>
            </div>
            <div class="content">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your password for the DSG Transport Portal has been reset by an administrator. Please use the new credentials below to log in:</p>
                
                <div class="credential-box">
                    <p class="label">Your Email</p>
                    <p class="value">{to_email}</p>
                    <br>
                    <p class="label">Your New Password</p>
                    <p class="value">{new_password}</p>
                </div>
                
                <div class="warning">
                    <p style="margin: 0;"><strong>⚠️ Security Recommendations:</strong></p>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                        <li>Log in immediately and verify your account</li>
                        <li>Keep your password confidential</li>
                        <li>Contact admin if you didn't request this reset</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>This is an automated message from DSG Transport LLC</p>
                    <p>© 2025 DSG Transport LLC. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Password Reset - DSG Transport Portal
    
    Hello {user_name},
    
    Your password has been reset by an administrator.
    
    Your New Credentials:
    Email: {to_email}
    Password: {new_password}
    
    Please log in and keep your password secure.
    
    - DSG Transport LLC
    """
    
    return send_email(to_email, subject, html_content, text_content)

