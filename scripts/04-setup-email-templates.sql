-- This script sets up professional email templates for Supabase Auth
-- Email templates need to be configured in the Supabase dashboard under Authentication > Email Templates
-- Below are the recommended templates to use

-- Note: Email templates in Supabase are configured via the dashboard, not through SQL
-- However, this file documents the recommended email content for each template type

-- ====================================
-- SIGN UP CONFIRMATION EMAIL TEMPLATE
-- ====================================
-- Subject: Confirm your email on Financial Community
-- Template variables available: {{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}

/*
Dear {{ .Email }},

Welcome to Financial Community! 👋

We're excited to have you join our community loan system. To complete your registration and secure your account, please confirm your email address by clicking the button below.

[CONFIRM EMAIL ADDRESS]
{{ .ConfirmationURL }}

This link will expire in 24 hours for your security.

---

IMPORTANT SECURITY INFORMATION:
✓ Only click this link if you initiated this sign-up
✓ Never share this link with anyone
✓ Financial Community will never ask for this link via email or phone
✓ If you didn't sign up for this account, you can safely ignore this email

---

WHAT'S NEXT?
Once you confirm your email, you'll be able to:
• Access your account dashboard
• View and manage your loans
• Record payments and track your financial history
• Connect with other community members

NEED HELP?
If you have any questions, please contact our support team at support@financialcommunity.com

---

Best regards,
Financial Community Team
support@financialcommunity.com

This is an automated message, please do not reply to this email.
*/

-- ====================================
-- PASSWORD RESET EMAIL TEMPLATE
-- ====================================
-- Subject: Reset your password on Financial Community
-- Template variables available: {{ .PasswordResetLink }}, {{ .Email }}, {{ .SiteURL }}

/*
Dear {{ .Email }},

We received a request to reset your password on Financial Community. If you initiated this request, please click the button below to set a new password.

[RESET PASSWORD]
{{ .PasswordResetLink }}

SECURITY REMINDERS:
⚠ This link will expire in 1 hour
⚠ Only click this link if you requested a password reset
⚠ Never share this link with anyone
⚠ Financial Community will never ask for your password via email
⚠ If you didn't request this, ignore this email and your password remains unchanged

---

IMPORTANT:
If you did NOT request this password reset, your account may have been compromised. 
Please contact support immediately at support@financialcommunity.com

---

STEPS TO RESET YOUR PASSWORD:
1. Click the link above or copy it into your browser
2. Enter your new password (minimum 6 characters)
3. Confirm your new password
4. You'll be redirected to sign in

NEED HELP?
If the link doesn't work or you need assistance, visit our support page or contact us at support@financialcommunity.com

---

Best regards,
Financial Community Team
support@financialcommunity.com

This is an automated message, please do not reply to this email.
*/

-- ====================================
-- EMAIL CHANGE CONFIRMATION TEMPLATE
-- ====================================
-- Subject: Confirm your new email on Financial Community
-- Template variables available: {{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}

/*
Dear User,

You've requested to change your email to {{ .Email }}. To complete this update, please confirm your new email address by clicking the link below.

[CONFIRM NEW EMAIL]
{{ .ConfirmationURL }}

This link will expire in 24 hours for your security.

SECURITY REMINDERS:
⚠ Only confirm this if you initiated the email change
⚠ Never share this link with anyone
⚠ If you didn't request this change, contact support immediately at support@financialcommunity.com

---

Best regards,
Financial Community Team
support@financialcommunity.com
*/
