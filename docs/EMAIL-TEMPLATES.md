# Email Templates Configuration Guide

## Overview

This document explains how to configure professional email templates for account verification and password reset in the Financial Community App.

## Supabase Email Templates

Supabase sends emails for:
1. **Email Confirmation** - Sent when users sign up
2. **Password Reset** - Sent when users request a password reset

### How to Configure Email Templates

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication → Email Templates**
3. Configure templates for "Confirm signup" and "Reset password"

## Email Template Best Practices

### 1. Confirmation Email (Sign Up)

**Subject Line:**
```
Welcome to Financial Community App - Confirm Your Email
```

**Email Content:**

```
Hello [User Name],

Thank you for joining the Financial Community App! We're excited to have you on board.

To complete your account setup and start accessing the community, please confirm your email address by clicking the link below:

[Confirm Email Button/Link]

This link will expire in 24 hours for security reasons.

Important:
- Do not share this link with anyone
- If you didn't create this account, please ignore this email
- For security, never share this link via chat or social media

Support:
If you have any questions or need assistance, please contact our support team at support@financialcommunity.com

Best regards,
Financial Community App Team
```

### 2. Password Reset Email

**Subject Line:**
```
Reset Your Financial Community App Password
```

**Email Content:**

```
Hello [User Name],

We received a request to reset your password for your Financial Community App account.

Click the link below to set a new password:

[Reset Password Button/Link]

This link will expire in 1 hour for your security.

Important:
- Only click this link if you requested a password reset
- Do not share this link with anyone
- Never share this link via email, chat, or social media
- If you didn't request this reset, please ignore this email and your password will remain unchanged

What to do:
1. Click the link above
2. Enter your new password
3. Confirm your password
4. Sign in with your new credentials

Support:
If you experience any issues, contact support@financialcommunity.com

Best regards,
Financial Community App Team
```

## Email Template Variables

Supabase provides these variables for your templates:

- `{{ .ConfirmationURL }}` - URL for email confirmation
- `{{ .RedirectTo }}` - Custom redirect URL
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - Authentication token
- `{{ .SiteURL }}` - Your site URL

## Template Testing

1. Create a test account
2. Check that the email arrives with:
   - Clear subject line
   - Your app name
   - Action-oriented content
   - Secure action button/link
   - Expiration time
   - Security warnings
   - Support contact information

## Email Design Guidelines

- Use a professional header with your app logo
- Keep text clear and scannable
- Use action buttons (more effective than plain links)
- Include security notices
- Add footer with support contact
- Ensure mobile responsiveness
- Use your brand colors appropriately

## Troubleshooting

### Emails Not Arriving
- Check spam/junk folders
- Verify email domain is authenticated
- Check Supabase email logs
- Ensure sender email is verified

### Incorrect Variables
- Verify variable syntax in templates
- Use double curly braces `{{ }}`
- Test with preview feature

### Link Expiration Issues
- Confirm redirect URL is correct
- Verify link in email is complete
- Check token expiration settings

## Support
For more information, visit:
- [Supabase Auth Email Documentation](https://supabase.com/docs/guides/auth/auth-email)
- [Email Best Practices](https://supabase.com/docs/guides/auth/customizing-email-templates)
