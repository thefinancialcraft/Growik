# Create Tables Using Supabase MCP Server

## Option 1: Using Supabase MCP Server (Recommended)

Once you have the Supabase MCP server connected in Cursor, you can use natural language commands like:

```
Create a table named user_profiles with the following columns:
- id: UUID, primary key, default gen_random_uuid()
- user_id: UUID, references auth.users(id), unique, not null
- email: TEXT, not null
- user_name: TEXT
- employee_id: TEXT
- role: TEXT, default 'user', check constraint ('user', 'admin')
- status: TEXT, default 'active', check constraint ('active', 'hold', 'suspend')
- approval_status: TEXT, default 'pending', check constraint ('pending', 'approved', 'rejected')
- created_at: TIMESTAMP WITH TIME ZONE, default NOW()
- updated_at: TIMESTAMP WITH TIME ZONE, default NOW()
```

Then ask the MCP server to:
1. Enable Row Level Security on user_profiles
2. Create policies for user access
3. Create triggers for automatic profile creation
4. Create indexes

## Option 2: Using SQL Directly (Current Setup)

The SQL schema is already prepared in `supabase-schema.sql`. You can:

1. **Via Supabase Dashboard:**
   - Go to your Supabase project
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase-schema.sql`
   - Click "Run"

2. **Via Supabase CLI:**
   ```bash
   # First, link your project (if not already linked)
   npx supabase link --project-ref your-project-ref
   
   # Then run the SQL
   npx supabase db execute --file supabase-schema.sql
   ```

## Option 3: Using Supabase CLI Migrations

```bash
# Initialize Supabase (if not already done)
npx supabase init

# Create a new migration
npx supabase migration new create_user_profiles

# Copy the SQL from supabase-schema.sql to the new migration file
# Then apply it
npx supabase db push
```

