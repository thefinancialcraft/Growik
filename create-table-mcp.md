# Create Table Using MCP Server - Step by Step

## Prerequisites
1. Supabase project created
2. MCP server connected to Supabase (if using MCP)

## MCP Server Commands

If you have Supabase MCP server connected, you can use these natural language commands:

### Step 1: Create the Table
```
Create a table called user_profiles with these columns:
- id as UUID primary key with default gen_random_uuid()
- user_id as UUID that references auth.users(id) with ON DELETE CASCADE, unique and not null
- email as TEXT not null
- user_name as TEXT
- employee_id as TEXT
- role as TEXT with default 'user' and check constraint allowing only 'user' or 'admin'
- status as TEXT with default 'active' and check constraint allowing 'active', 'hold', or 'suspend'
- approval_status as TEXT with default 'pending' and check constraint allowing 'pending', 'approved', or 'rejected'
- created_at as TIMESTAMP WITH TIME ZONE with default NOW()
- updated_at as TIMESTAMP WITH TIME ZONE with default NOW()
```

### Step 2: Enable Row Level Security
```
Enable Row Level Security on the user_profiles table
```

### Step 3: Create Policies
```
Create a policy on user_profiles that allows users to SELECT their own rows where auth.uid() = user_id
Create a policy on user_profiles that allows users to UPDATE their own rows where auth.uid() = user_id
Create a policy on user_profiles that allows admins to SELECT all rows where the user's role is 'admin'
Create a policy on user_profiles that allows admins to UPDATE all rows where the user's role is 'admin'
```

### Step 4: Create Functions and Triggers
```
Create a function handle_new_user() that inserts a new row into user_profiles when a new user is created in auth.users
Create a trigger on_auth_user_created that calls handle_new_user() after INSERT on auth.users
Create a function handle_updated_at() that updates the updated_at timestamp
Create a trigger update_user_profiles_updated_at that calls handle_updated_at() before UPDATE on user_profiles
```

### Step 5: Create Indexes
```
Create indexes on user_profiles for: user_id, email, role, and approval_status
```

## Alternative: Use the Prepared SQL

If you prefer to use the SQL directly (which is already prepared), you can:

1. **In Cursor with MCP**: Ask the MCP server to "Execute the SQL from supabase-schema.sql file"
2. **Manually**: Copy the SQL from `supabase-schema.sql` and run it in Supabase SQL Editor

