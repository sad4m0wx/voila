-- =====================================================
-- Quick Fix: Update get_group_member_addresses function
-- =====================================================
-- This fixes the ambiguous column reference error

-- Drop and recreate the function with proper table aliases
DROP FUNCTION IF EXISTS public.get_group_member_addresses(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_group_member_addresses(group_id UUID, requesting_user_id UUID)
RETURNS TABLE(
    user_id UUID,
    name TEXT,
    formatted_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default BOOLEAN
) AS $$
BEGIN
    -- Check if requesting user is a member of the group
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = get_group_member_addresses.group_id 
        AND gm.user_id = get_group_member_addresses.requesting_user_id
    ) THEN
        RETURN;
    END IF;
    
    -- Return addresses for all group members
    RETURN QUERY
    SELECT 
        ua.user_id,
        ua.name,
        ua.formatted_address,
        ua.latitude,
        ua.longitude,
        ua.is_default
    FROM public.user_addresses ua
    INNER JOIN public.group_members gm ON ua.user_id = gm.user_id
    WHERE gm.group_id = get_group_member_addresses.group_id
    ORDER BY ua.user_id, ua.is_default DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.get_group_member_addresses IS 'Retrieves addresses for all members of a group (elevated privileges) - FIXED AMBIGUOUS COLUMNS';

-- Test the function (optional - replace with actual group_id and user_id)
-- SELECT * FROM public.get_group_member_addresses('your-group-id-here', 'your-user-id-here'); 