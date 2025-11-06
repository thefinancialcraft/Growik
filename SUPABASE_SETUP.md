# Supabase Setup Guide

This guide will help you set up Supabase for your TFC-Nexus application.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A Supabase project created

## Step 1: Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details:
   - Name: Your project name
   - Database Password: Choose a strong password (save this!)
   - Region: Choose the closest region to your users
4. Wait for the project to be created (takes a few minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll find:
   - **Project URL**: Your Supabase project URL
   - **anon/public key**: Your public/anonymous key

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Step 4: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy and paste the contents of `supabase-schema.sql`
3. Click "Run" to execute the SQL
4. This will create:
   - `user_profiles` table
   - Row Level Security (RLS) policies
   - Automatic profile creation trigger
   - Indexes for performance

## Step 5: Configure Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Enable **Email** provider (already enabled by default)
3. To enable **Google OAuth**:
   - Click on "Google"
   - Enable the provider
   - Add your Google OAuth credentials (Client ID and Secret)
   - Add redirect URL: `http://localhost:8080/auth/callback` (for development)
   - Add production redirect URL: `https://yourdomain.com/auth/callback`

## Step 6: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs:
   - **Site URL**: `http://localhost:8080` (development) or your production URL
   - **Redirect URLs**: 
     - `http://localhost:8080/auth/callback`
     - `https://yourdomain.com/auth/callback` (production)

## Step 7: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser
3. Check the browser console for connection messages
4. Try signing up with a new account

## Database Tables

### user_profiles

Stores user profile information linked to Supabase Auth users.

**Columns:**
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to `auth.users`
- `email` (TEXT): User email
- `user_name` (TEXT): User's display name
- `employee_id` (TEXT): Optional employee ID
- `role` (TEXT): User role ('user' or 'admin')
- `status` (TEXT): User status ('active', 'hold', 'suspend')
- `approval_status` (TEXT): Approval status ('pending', 'approved', 'rejected')
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

## Security Features

- **Row Level Security (RLS)**: Enabled on all tables
- Users can only view/update their own profiles
- Admins have full access to all profiles
- Automatic profile creation on user signup

## Troubleshooting

### Connection Issues
- Verify your `.env` file has the correct credentials
- Check that your Supabase project is active
- Ensure you're using the correct project URL (not the API URL)

### Authentication Issues
- Verify redirect URLs are configured correctly
- Check that email confirmation is set up correctly in Supabase settings
- For Google OAuth, ensure OAuth credentials are correct

### Database Issues
- Verify the schema has been created successfully
- Check RLS policies are enabled
- Ensure triggers are created for automatic profile creation

## Next Steps

- Customize the user profile schema if needed
- Add additional tables for your application data
- Configure email templates in Supabase Auth settings
- Set up database backups

