# Setting Up Professional Email Templates in Supabase

This guide explains how to configure professional, trustworthy email templates in your Supabase project to ensure users receive clear, secure communications about their accounts.

## Overview

Supabase Auth sends three types of emails:
1. **Sign Up Confirmation** - Verify new user emails
2. **Password Reset** - Allow users to reset forgotten passwords
3. **Email Change** - Confirm email address updates

## How to Configure Email Templates

### Step 1: Access Supabase Dashboard

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **Authentication** → **Email Templates**

### Step 2: Configure Each Template

For each email template (Confirm signup, Reset password, Change email), you need to:

#### Template Variables Available:
- `{{ .ConfirmationURL }}` - The confirmation/reset link
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL
- `{{ .Token }}` - Authentication token (if needed)

#### Best Practices for Each Template:

### 1. Confirm Signup Email

**Subject Line:**
\`\`\`
Confirm your email on Financial Community
\`\`\`

**Body:**
Include:
- ✅ Friendly greeting
- ✅ App name (Financial Community)
- ✅ Clear action (Confirm email)
- ✅ Secure button/link: `{{ .ConfirmationURL }}`
- ✅ Expiration time (24 hours)
- ✅ Security reminders (don't share link, only click if you signed up)
- ✅ What happens next
- ✅ Support contact: support@financialcommunity.com

**Key Security Messages:**
- "Only click this link if you initiated this sign-up"
- "Never share this link with anyone"
- "If you didn't sign up, ignore this email"

---

### 2. Reset Password Email

**Subject Line:**
\`\`\`
Reset your password on Financial Community
\`\`\`

**Body:**
Include:
- ✅ Friendly greeting
- ✅ Clear action (Reset password)
- ✅ Secure button/link: `{{ .PasswordResetLink }}`
- ✅ Expiration time (1 hour)
- ✅ Security reminders
- ✅ Warning if account may be compromised
- ✅ Steps to reset password
- ✅ Support contact

**Key Security Messages:**
- "This link will expire in 1 hour"
- "Only click this link if you requested a password reset"
- "Never share this link with anyone"
- "If you didn't request this, your account may be compromised"
- "Contact support immediately"

---

### 3. Change Email Address

**Subject Line:**
\`\`\`
Confirm your new email on Financial Community
\`\`\`

**Body:**
Similar to sign up but mentions changing email address instead of creating account.

---

## Step-by-Step Configuration in Dashboard

1. Click **Authentication** in the left sidebar
2. Click **Email Templates**
3. For each template type:
   - Click **Edit** or the template name
   - Update the **Subject**
   - Update the **Email Body** with professional HTML or plain text
   - Click **Save**

---

## Email Template Content Checklist

For EVERY email, ensure:

✅ **Subject Line**
- Clear and specific (avoid generic subjects)
- Include app name when space allows

✅ **Greeting**
- Friendly but professional
- Use user's email or generic greeting

✅ **Action/Purpose**
- Clearly explain WHY user is receiving this email
- Use simple language

✅ **App Name & Branding**
- Include "Financial Community" prominently
- Use consistent branding

✅ **Secure Action Button/Link**
- Make the button prominent
- Include full link for copy-paste: `{{ .ConfirmationURL }}` or `{{ .PasswordResetLink }}`

✅ **Expiration Time**
- Clearly state how long the link is valid
- Sign up: 24 hours
- Password reset: 1 hour

✅ **Security Reminders**
- "Don't share this link"
- "Only click if you initiated this"
- "Never reply with sensitive info"
- "If you didn't request this..."

✅ **Support Contact**
- Email: support@financialcommunity.com
- Clear instructions for getting help

✅ **Footer**
- Copyright/team name: "Financial Community Team"
- Support contact again
- Note that it's an automated message

---

## Testing Email Templates

1. Create a test account with your email
2. Check that the confirmation email arrives
3. Verify all links work correctly
4. Test the reset password flow
5. Ensure formatting looks good in different email clients

---

## Email Best Practices

1. **Mobile Responsive** - Ensure emails look good on phones
2. **Plain Text Alternative** - Include text version for email clients
3. **Professional Tone** - Keep language clear and friendly
4. **CTA Buttons** - Make action buttons prominent
5. **No Typos** - Proofread carefully
6. **Test Links** - Verify all URLs are correct
7. **Branding Consistency** - Use company colors/logo where appropriate
8. **Privacy** - Include privacy policy link in footer
9. **Unsubscribe** - For non-auth emails, include unsubscribe (not needed for auth emails)
10. **Compliance** - Comply with email regulations (CAN-SPAM, GDPR, etc.)

---

## Troubleshooting

**Emails not being sent:**
- Verify SMTP configuration in Auth settings
- Check if sender email is verified
- Review Supabase logs for errors

**Links not working:**
- Ensure `{{ .ConfirmationURL }}` variable is used (not custom URLs)
- Check that site URL is configured correctly in settings

**Formatting issues:**
- Test in Gmail, Outlook, and mobile clients
- Ensure CSS is inline (not in style tags)
- Avoid complex formatting that breaks in clients

---

## Support

For more information on Supabase email templates, visit:
https://supabase.com/docs/guides/auth/auth-email-templates
