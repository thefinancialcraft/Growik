-- ============================================
-- Database Schema Recreation Script
-- Generated from existing Supabase database
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- ============================================
-- TABLES
-- ============================================

-- Table: user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    email TEXT NOT NULL,
    contact_no TEXT,
    role TEXT DEFAULT 'user' CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text])),
    status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'hold'::text, 'suspend'::text])),
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
    super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    employee_id TEXT UNIQUE CHECK (employee_id IS NULL OR employee_id ~ '^GRWK-\\d{3}$'::text),
    status_reason TEXT,
    hold_duration_days INTEGER,
    hold_end_time TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON COLUMN public.user_profiles.status_reason IS 'Reason for status change provided by admin';
COMMENT ON COLUMN public.user_profiles.hold_duration_days IS 'Number of days for hold status';
COMMENT ON COLUMN public.user_profiles.hold_end_time IS 'End time for hold status';

-- Table: admin_members
CREATE TABLE IF NOT EXISTS public.admin_members (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: contracts
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'draft'::text])),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    contract_value NUMERIC,
    currency TEXT DEFAULT 'USD',
    contract_type TEXT,
    company_name TEXT,
    contact_person TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    content TEXT,
    variables JSONB DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES auth.users(id),
    pid TEXT
);

COMMENT ON TABLE public.contracts IS 'Stores contract information and management data';
COMMENT ON COLUMN public.contracts.status IS 'Contract status: active, inactive, or draft';
COMMENT ON COLUMN public.contracts.created_by IS 'User who created the contract';
COMMENT ON COLUMN public.contracts.assigned_to IS 'User assigned to manage the contract';
COMMENT ON COLUMN public.contracts.content IS 'Rich text HTML content of the contract document';
COMMENT ON COLUMN public.contracts.variables IS 'Custom variables stored as key-value pairs in JSON format';
COMMENT ON COLUMN public.contracts.updated_by IS 'User who last updated the contract';

-- Table: messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'sent' CHECK (status = ANY (ARRAY['sending'::text, 'sent'::text, 'delivered'::text, 'read'::text])),
    media_url TEXT,
    media_type TEXT CHECK (media_type = ANY (ARRAY['image'::text, 'file'::text, 'voice'::text])),
    message_type TEXT DEFAULT 'text' CHECK (message_type = ANY (ARRAY['text'::text, 'media'::text, 'voice'::text]))
);

-- Table: influencers
CREATE TABLE IF NOT EXISTS public.influencers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pid TEXT UNIQUE,
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    categories TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
    address_line1 TEXT,
    address_line2 TEXT,
    address_landmark TEXT,
    address_city TEXT,
    address_pincode TEXT,
    address_country TEXT
);

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT UNIQUE,
    name TEXT NOT NULL,
    company TEXT,
    description TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'USD',
    category TEXT,
    status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    company_description TEXT,
    manager_name TEXT,
    manager_contact TEXT
);

-- Table: companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    manager_name TEXT,
    manager_contact TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    categories TEXT[] DEFAULT ARRAY[]::text[]
);

-- Table: campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    objective TEXT,
    users JSONB DEFAULT '[]'::jsonb,
    influencers JSONB DEFAULT '[]'::jsonb,
    contract_id UUID REFERENCES public.contracts(id),
    contract_snapshot JSONB,
    status TEXT DEFAULT 'draft',
    progress NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    start_date DATE,
    end_date DATE,
    is_long_term BOOLEAN DEFAULT false
);

-- Table: collaboration_variable_overrides
CREATE TABLE IF NOT EXISTS public.collaboration_variable_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    influencer_id UUID,
    variable_key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    collaboration_id TEXT UNIQUE,
    contract_html TEXT
);

-- Table: collaboration_actions
CREATE TABLE IF NOT EXISTS public.collaboration_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    influencer_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    remark TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    collaboration_id TEXT UNIQUE,
    contract_id UUID REFERENCES public.contracts(id)
);

-- Table: collaboration_timeline
CREATE TABLE IF NOT EXISTS public.collaboration_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaboration_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type = ANY (ARRAY['action_taken'::text, 'remark_added'::text, 'contract_sent'::text, 'contract_viewed'::text, 'contract_updated'::text, 'variable_updated'::text, 'status_changed'::text])),
    description TEXT NOT NULL,
    remark TEXT,
    action TEXT,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status ON public.user_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON public.user_profiles(employee_id);

-- Indexes for contracts
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_to ON public.contracts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_pid ON public.contracts(pid);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(is_read);

-- Indexes for influencers
CREATE INDEX IF NOT EXISTS idx_influencers_pid ON public.influencers(pid);
CREATE INDEX IF NOT EXISTS idx_influencers_handle ON public.influencers(handle);
CREATE INDEX IF NOT EXISTS idx_influencers_status ON public.influencers(status);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_contract_id ON public.campaigns(contract_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- Indexes for collaboration tables
CREATE INDEX IF NOT EXISTS idx_collaboration_variable_overrides_campaign_id ON public.collaboration_variable_overrides(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_variable_overrides_influencer_id ON public.collaboration_variable_overrides(influencer_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_variable_overrides_collaboration_id ON public.collaboration_variable_overrides(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_actions_campaign_id ON public.collaboration_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_actions_influencer_id ON public.collaboration_actions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_actions_collaboration_id ON public.collaboration_actions(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_timeline_collaboration_id ON public.collaboration_timeline(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_timeline_action_type ON public.collaboration_timeline(action_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_variable_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_timeline ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies are typically created separately based on your security requirements
-- You may need to add specific policies for each table based on your access control needs

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for contracts updated_at
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON public.contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for messages updated_at
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for influencers updated_at
DROP TRIGGER IF EXISTS update_influencers_updated_at ON public.influencers;
CREATE TRIGGER update_influencers_updated_at
    BEFORE UPDATE ON public.influencers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for products updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for companies updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for collaboration_variable_overrides updated_at
DROP TRIGGER IF EXISTS set_updated_at_collab_overrides ON public.collaboration_variable_overrides;
CREATE TRIGGER set_updated_at_collab_overrides
    BEFORE UPDATE ON public.collaboration_variable_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- GRANTS (if needed)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================
-- END OF SCHEMA SCRIPT
-- ============================================

