# Supabase Environment Variables Update Guide

## 📝 How to Update .env File

### Step 1: Create/Edit `.env` file in project root

Create a file named `.env` in the root directory (`D:\React Project\Growik\.env`)

### Step 2: Add the following variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_SUPABASE_SERVICE_KEY=your_supabase_service_key_here
```

### Step 3: Get Your Supabase Keys

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:

   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `VITE_SUPABASE_SERVICE_KEY` (optional, for admin operations)

### Step 4: Update .env File

Replace the placeholder values with your actual keys:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 5: Restart Development Server

After updating `.env`, restart your development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## ⚠️ Important Notes

1. **Never commit `.env` to Git** - It's already in `.gitignore`
2. **Keep Service Key Secret** - The service_role key has admin access
3. **Required Variables**:
   - `VITE_SUPABASE_URL` - **Required**
   - `VITE_SUPABASE_ANON_KEY` - **Required**
   - `VITE_SUPABASE_SERVICE_KEY` - **Optional** (only needed for admin operations)

## 🔍 Verify Configuration

After updating, check the browser console when the app loads. You should see:
- No "Missing Supabase environment variables" errors
- Successful connection messages

## 📋 Example .env File Structure

```
# .env file location: D:\React Project\Growik\.env

VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🆘 Troubleshooting

### "Missing Supabase environment variables" Error
- Check that `.env` file exists in project root
- Verify variable names start with `VITE_`
- Restart dev server after changes

### Connection Issues
- Verify URL format: `https://xxxxx.supabase.co`
- Check that keys are complete (no truncation)
- Ensure no extra spaces or quotes around values

