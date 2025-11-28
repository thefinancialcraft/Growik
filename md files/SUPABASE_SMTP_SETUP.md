# Supabase SMTP Configuration for Email Confirmation

## Problem
Supabase is trying to send confirmation emails but failing with error: `"Error sending confirmation email"`. This happens because Supabase's default email service may not be configured or has limitations.

## Solution: Configure Custom SMTP in Supabase

Configure Supabase to use your Zoho SMTP settings so confirmation emails work properly.

## Step-by-Step Instructions

### 1. Access Supabase Dashboard
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project

### 2. Navigate to Auth Settings
1. Click on **Settings** (gear icon) in the left sidebar
2. Click on **Auth** in the settings menu
3. Scroll down to find **SMTP Settings** section

### 3. Enable Custom SMTP
1. Toggle **Enable Custom SMTP** to ON
2. Fill in the following Zoho SMTP details:

```
SMTP Host: smtppro.zoho.in
SMTP Port: 465
SMTP User: contact@growwik.com
SMTP Password: Growwik@8521
Sender Email: contact@growwik.com
Sender Name: Growwik Media
```

### 4. Enable Email Confirmations
1. Go to **Authentication** → **Settings**
2. Scroll to **Email Auth** section
3. Make sure **Enable email confirmations** is **ON** (enabled)
4. Configure email templates if needed:
   - **Confirm signup** template
   - **Magic Link** template
   - **Change Email Address** template
   - **Reset Password** template

### 5. Test Configuration
1. Click **Save** to save SMTP settings
2. Try signing up a new user
3. Check the user's email inbox for confirmation email
4. User should receive email from `contact@growwik.com`

## Email Template Customization (Optional)

You can customize the email templates in Supabase:

1. Go to **Authentication** → **Email Templates**
2. Select the template you want to customize:
   - **Confirm signup** - Sent when user signs up
   - **Magic Link** - For passwordless login
   - **Change Email Address** - When user changes email
   - **Reset Password** - For password reset
3. Customize the subject and body
4. Use variables like `{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.

## Verification Steps

After configuration:

1. **Test Signup:**
   - Create a new user account
   - Check email inbox (including spam folder)
   - Click confirmation link in email
   - User should be able to login after confirmation

2. **Check Email Delivery:**
   - Emails should come from `contact@growwik.com`
   - Sender name should be "Growwik Media"
   - Emails should arrive within a few seconds

3. **Verify SMTP Connection:**
   - Supabase will test the SMTP connection when you save
   - If there's an error, check:
     - SMTP credentials are correct
     - Port 465 is correct (SSL/TLS)
     - Zoho account allows SMTP access
     - Firewall isn't blocking the connection

## Troubleshooting

### Email Not Sending
- Verify SMTP credentials are correct
- Check Zoho account settings allow SMTP
- Ensure port 465 is not blocked
- Check Supabase logs for SMTP errors

### Email Going to Spam
- Configure SPF, DKIM, and DMARC records for your domain
- Use a verified sender email
- Avoid spam trigger words in email content

### Connection Timeout
- Verify SMTP host: `smtppro.zoho.in`
- Check port 465 is correct
- Ensure SSL/TLS is enabled
- Check network/firewall settings

## Important Notes

- **Same SMTP for All Emails:** Both Supabase auth emails and your custom email API now use the same Zoho SMTP
- **Email Limits:** Be aware of Zoho's email sending limits
- **Security:** Keep SMTP password secure, never commit to git
- **Testing:** Always test in development before production

## Alternative: Use Supabase's Built-in Email Service

If you prefer not to use custom SMTP:
1. Keep **Enable Custom SMTP** OFF
2. Supabase will use its default email service
3. May have rate limits or delivery issues
4. Less control over email content and branding

## Current Configuration Summary

- **SMTP Provider:** Zoho Mail
- **SMTP Host:** smtppro.zoho.in
- **Port:** 465 (SSL/TLS)
- **Sender:** contact@growwik.com (Growwik Media)
- **Used For:**
  - Supabase authentication emails (signup confirmation, password reset, etc.)
  - Custom email API (contract signing links, etc.)

