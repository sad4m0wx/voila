import { supabase } from '../config';
import { normalizePhoneNumber } from '../utils/phoneUtils';

class GroupsService {
  // Create a new group
  async createGroup(userId, groupData, initialMembers = []) {
    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupData.name,
          description: groupData.description || null,
          created_by: userId,
          is_active: true,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'member',
        });

      if (memberError) throw memberError;

      // Add initial members
      if (initialMembers.length > 0) {
        const memberInserts = initialMembers.map(member => ({
          group_id: group.id,
          user_id: member.user_id,
          role: 'member',
        }));

        const { error: initialMembersError } = await supabase
          .from('group_members')
          .insert(memberInserts);

        if (initialMembersError) throw initialMembersError;
      }

      return group;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  // Get user's groups
  async getUserGroups(userId) {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          groups (
            id,
            name,
            description,
            created_by,
            is_active,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('groups.is_active', true);

      if (error) throw error;

      return data.map(item => item.groups);
    } catch (error) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  }

  // Get specific group
  async getGroup(groupId) {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting group:', error);
      throw error;
    }
  }

  // Get group members with attendance status
  async getGroupMembers(groupId, currentUserId) {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          profiles!group_members_user_id_fkey (
            id,
            display_name,
            phone_number
          )
        `)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      // Get attendance data for this group
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('group_attendance')
        .select('user_id, is_attending, confirmed_at')
        .eq('group_id', groupId);

      if (attendanceError) {
        console.warn('Error getting attendance data:', attendanceError);
      }

      // Get custom locations for this group
      const { data: customLocations, error: customError } = await supabase
        .from('group_custom_locations')
        .select(`
          id,
          name,
          address,
          latitude,
          longitude,
          is_attending,
          created_by,
          created_at,
          profiles!group_custom_locations_created_by_fkey (
            display_name
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (customError) {
        console.warn('Error getting custom locations:', customError);
      }

      // Create attendance map
      const attendanceMap = new Map();
      if (attendanceData) {
        attendanceData.forEach(att => {
          attendanceMap.set(att.user_id, {
            isAttending: att.is_attending,
            confirmedAt: att.confirmed_at
          });
        });
      }

      // Combine regular members and custom locations
      const members = data.map(member => ({
        id: member.id,
        user_id: member.user_id,
        display_name: member.profiles.display_name,
        phone_number: member.profiles.phone_number,
        role: member.role,
        joined_at: member.joined_at,
        is_me: member.user_id === currentUserId,
        attendance: attendanceMap.get(member.user_id) || null,
        type: 'user',
      }));

      // Add custom locations as virtual attendees
      if (customLocations && customLocations.length > 0) {
        const customLocationMembers = customLocations.map(location => ({
          id: `custom_location_${location.id}`,
          user_id: null, // No user_id for custom locations
          display_name: location.name,
          phone_number: null,
          role: 'location',
          joined_at: location.created_at,
          is_me: false,
          attendance: {
            isAttending: location.is_attending,
            confirmedAt: location.created_at,
            // Include location coordinates for meeting point calculation
            location_lat: location.latitude,
            location_lng: location.longitude,
          },
          type: 'custom_location',
          address: location.address,
          coordinates: [location.longitude, location.latitude], // [lng, lat] format for meeting point API
          created_by: location.profiles?.display_name || 'Unknown',
        }));

        // Add custom locations to the members array
        members.push(...customLocationMembers);
      }

      return members;
    } catch (error) {
      console.error('Error getting group members:', error);
      throw error;
    }
  }

  // Add member to group
  async addGroupMember(groupId, userId, currentUserId) {
    try {
      // Check if current user is a member of the group
      const { data: memberCheck, error: memberError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .single();

      if (memberError) throw new Error('You must be a group member to add others');

      // Add new member
      const { data, error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'member',
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error adding group member:', error);
      throw error;
    }
  }

  // Remove member from group
  async removeGroupMember(groupId, userId, currentUserId) {
    try {
      // Check if current user is a member of the group
      const { data: memberCheck, error: memberError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .single();

      if (memberError) throw new Error('You must be a group member to remove others');

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error removing group member:', error);
      throw error;
    }
  }

  // Update group
  async updateGroup(groupId, updates, currentUserId) {
    try {
      // Check if current user is a member of the group
      const { data: memberCheck, error: memberError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .single();

      if (memberError) throw new Error('You must be a group member to update group');

      const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  // Delete group
  async deleteGroup(groupId, currentUserId) {
    try {
      // Check if current user is the creator
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      if (group.created_by !== currentUserId) {
        throw new Error('Only group creator can delete group');
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Search for users by name only to add to group
  async searchUsers(searchTerm, currentUserId, limit = 10) {
    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, phone_number')
        .neq('id', currentUserId)
        .ilike('display_name', `%${searchTerm}%`)
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Find users by phone numbers (for contact import)
  async findUsersByPhoneNumbers(phoneNumbers) {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    try {
      // Create variations for each phone number (with/without +)
      const phoneVariations = [];
      phoneNumbers.forEach(phone => {
        if (phone) {
          phoneVariations.push(phone);
          
          // Add opposite format (with/without +)
          if (phone.startsWith('+')) {
            phoneVariations.push(phone.substring(1));
          } else {
            phoneVariations.push('+' + phone);
          }
        }
      });

      // Remove duplicates
      const uniquePhoneVariations = [...new Set(phoneVariations)];
      
      // Query profiles with phone number in the variations
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, phone_number')
        .in('phone_number', uniquePhoneVariations)
        .not('phone_number', 'is', null);

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      return profiles || [];
      
    } catch (error) {
      console.error('Error finding users by phone numbers:', error);
      throw error;
    }
  }

  // Update attendance status
  async updateAttendance(groupId, userId, isAttending, location = null) {
    try {
      const { data, error } = await supabase
        .from('group_attendance')
        .upsert({
          group_id: groupId,
          user_id: userId,
          is_attending: isAttending,
          location_lat: location?.lat,
          location_lng: location?.lng,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'group_id,user_id', // Specify the unique constraint columns
          ignoreDuplicates: false // Update existing records
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  }

  // Get attendance for a specific user in a group
  async getUserAttendance(groupId, userId) {
    try {
      const { data, error } = await supabase
        .from('group_attendance')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user attendance:', error);
      return null;
    }
  }

  // Reset all attendance for a group
  async resetGroupAttendance(groupId, userId) {
    try {
      // Check if current user is a member of the group
      const { data: memberCheck, error: memberError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (memberError) throw new Error('You must be a group member to reset attendance');

      // Delete all attendance records for this group
      const { error } = await supabase
        .from('group_attendance')
        .delete()
        .eq('group_id', groupId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error resetting group attendance:', error);
      throw error;
    }
  }

  // Subscribe to group changes
  subscribeToGroup(groupId, callback) {
    const subscription = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'groups',
          filter: `id=eq.${groupId}`
        }, 
        callback
      )
      .subscribe();

    return subscription;
  }

  // Get user addresses for group members (uses elevated privileges function)
  async getGroupMemberAddresses(groupId, requestingUserId) {
    try {
      const { data, error } = await supabase.rpc('get_group_member_addresses', {
        group_id: groupId,
        requesting_user_id: requestingUserId
      });

      if (error) throw error;

      // Group addresses by user_id and take the first (default or first available)
      const addressesByUser = {};
      data.forEach(address => {
        if (!addressesByUser[address.user_id]) {
          addressesByUser[address.user_id] = {
            ...address,
            address: address.formatted_address // Map to expected field name
          };
        }
      });

      return addressesByUser;
    } catch (error) {
      console.error('Error getting group member addresses:', error);
      return {};
    }
  }

  // Get user addresses by user IDs (fallback method)
  async getUserAddresses(userIds) {
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('user_id, name, formatted_address, latitude, longitude, is_default')
        .in('user_id', userIds)
        .order('is_default', { ascending: false }); // Default addresses first

      if (error) throw error;

      // Group addresses by user_id and take the first (default or first available)
      const addressesByUser = {};
      data.forEach(address => {
        if (!addressesByUser[address.user_id]) {
          addressesByUser[address.user_id] = {
            ...address,
            address: address.formatted_address // Map to expected field name
          };
        }
      });

      return addressesByUser;
    } catch (error) {
      console.error('Error getting user addresses:', error);
      return {};
    }
  }

  // Subscribe to group members changes
  subscribeToGroupMembers(groupId, callback) {
    const subscription = supabase
      .channel(`group_members:${groupId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'group_members',
          filter: `group_id=eq.${groupId}`
        }, 
        callback
      )
      .subscribe();

    return subscription;
  }

  // Add custom location to group
  async addCustomLocationToGroup(groupId, location, createdBy) {
    try {
      const insertData = {
        group_id: groupId,
        name: location.display_name || location.address,
        address: location.address,
        latitude: location.coordinates[1], // lat is second in [lng, lat]
        longitude: location.coordinates[0], // lng is first in [lng, lat]
        place_id: location.placeId,
        is_attending: location.isAttending !== undefined ? location.isAttending : true,
        created_by: createdBy,
      };

      const { data, error } = await supabase
        .from('group_custom_locations')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding custom location to group:', error);
      throw error;
    }
  }

  // Get custom locations for a group
  async getGroupCustomLocations(groupId) {
    try {
      const { data, error } = await supabase
        .from('group_custom_locations')
        .select(`
          id,
          name,
          address,
          latitude,
          longitude,
          place_id,
          is_attending,
          created_by,
          created_at,
          profiles!group_custom_locations_created_by_fkey (
            display_name
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting group custom locations:', error);
      return [];
    }
  }

  // Update custom location attendance
  async updateCustomLocationAttendance(locationId, isAttending) {
    try {
      const { data, error } = await supabase
        .from('group_custom_locations')
        .update({ is_attending: isAttending })
        .eq('id', locationId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating custom location attendance:', error);
      throw error;
    }
  }

  // Remove custom location from group
  async removeCustomLocationFromGroup(locationId, userId) {
    try {
      // Check if user is the creator or a group member
      const { data: location, error: locationError } = await supabase
        .from('group_custom_locations')
        .select('group_id, created_by')
        .eq('id', locationId)
        .single();

      if (locationError) throw locationError;

      // Check if user is the creator or a group member
      if (location.created_by !== userId) {
        const { data: memberCheck, error: memberError } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', location.group_id)
          .eq('user_id', userId)
          .single();

        if (memberError) throw new Error('You must be a group member to remove locations');
      }

      const { error } = await supabase
        .from('group_custom_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error removing custom location:', error);
      throw error;
    }
  }

  // TEMPORARY: Fix phone numbers in profiles table
  async fixPhoneNumbers() {
    try {
      // Get current user to make sure we have auth access
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return false;
      }

      // Use SQL to update profiles table with phone numbers from auth.users
      const { data, error } = await supabase.rpc('fix_phone_numbers');
      
      if (error) {
        console.error('Error fixing phone numbers:', error);
        
        // If the function doesn't exist, try direct update
        console.log('Trying direct update approach...');
        
        // Update current user's profile with their phone number
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ phone_number: user.phone })
          .eq('id', user.id);
          
        if (updateError) {
          console.error('Error updating current user phone:', updateError);
          return false;
        } else {
          console.log('Updated current user phone number');
          return true;
        }
      }

      console.log('Phone numbers fixed successfully');
      return true;
    } catch (error) {
      console.error('Error in fixPhoneNumbers:', error);
      return false;
    }
  }
}

export const groupsService = new GroupsService();
export default groupsService; 