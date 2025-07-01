-- =====================================================
-- Add Group Custom Locations Table
-- =====================================================
-- Run this to add support for custom addresses in groups

-- Create table for group custom locations
CREATE TABLE IF NOT EXISTS public.group_custom_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    place_id TEXT,
    is_attending BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add foreign key constraints
ALTER TABLE public.group_custom_locations 
ADD CONSTRAINT group_custom_locations_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.group_custom_locations 
ADD CONSTRAINT group_custom_locations_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Disable RLS for simplicity (same as other group tables)
ALTER TABLE public.group_custom_locations DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS group_custom_locations_group_id_idx ON public.group_custom_locations(group_id);
CREATE INDEX IF NOT EXISTS group_custom_locations_created_by_idx ON public.group_custom_locations(created_by);

-- Create trigger for updated_at
CREATE TRIGGER handle_group_custom_locations_updated_at
    BEFORE UPDATE ON public.group_custom_locations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add comment
COMMENT ON TABLE public.group_custom_locations IS 'Custom locations/addresses added to groups for meeting planning'; 