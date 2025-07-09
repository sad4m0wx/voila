import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../lib/contexts/AuthContext';
import { useGroups } from '../../../lib/contexts/GroupsContext';
import { AddressInput } from '../../../lib/components/maps';
import SlideToConfirm from '../../../lib/components/utils/SlideToConfirm';



export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const {
    currentGroup,
    currentGroupMembers,
    loading,
    error,
    loadGroup,
    loadGroupMembers,
    updateGroupInfo,
    addGroupMember,
    removeGroupMember,
    resetGroupAttendance,
    deleteGroup,
    clearError,
    addCustomLocationToGroup,
    updateMyAttendance,
    updateUserAttendance,
    updateCustomLocationAttendance,
    removeCustomLocationFromGroup,
  } = useGroups();


  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [groupName, setGroupName] = useState(currentGroup?.name || '');
  const [groupDescription, setGroupDescription] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberAddCount, setMemberAddCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Load group data when component mounts
  useEffect(() => {
    if (id && user) {
      loadGroup(id);
    }
  }, [id, user, loadGroup]);

  // Update local state when group data changes
  useEffect(() => {
    if (currentGroup) {
      setGroupName(currentGroup.name || '');
      setGroupDescription(currentGroup.description || '');
    }
  }, [currentGroup]);

  // Check if current user is admin (removed - all members can manage)
  const canManageGroup = currentGroupMembers.find(
    member => member.user_id === user?.uid
  );

  // Handle group name update
  const handleUpdateName = useCallback(async () => {
    if (!currentGroup || !groupName.trim() || groupName === currentGroup.name) {
      setEditingName(false);
      setGroupName(currentGroup?.name || '');
      return;
    }

    try {
      const success = await updateGroupInfo(currentGroup.id, { name: groupName.trim() });
      if (success) {
        setEditingName(false);
      }
    } catch (error) {
      console.error('Error updating group name:', error);
      Alert.alert('Error', 'Failed to update group name');
      setGroupName(currentGroup.name || '');
    }
  }, [currentGroup, groupName, updateGroupInfo]);

  // Handle group description update
  const handleUpdateDescription = useCallback(async () => {
    if (!currentGroup || groupDescription === (currentGroup.description || '')) {
      setEditingDescription(false);
      setGroupDescription(currentGroup?.description || '');
      return;
    }

    try {
      const success = await updateGroupInfo(currentGroup.id, { 
        description: groupDescription.trim() || null 
      });
      if (success) {
        setEditingDescription(false);
      }
    } catch (error) {
      console.error('Error updating group description:', error);
      Alert.alert('Error', 'Failed to update group description');
      setGroupDescription(currentGroup.description || '');
    }
  }, [currentGroup, groupDescription, updateGroupInfo]);

  // Add member to group
  const handleAddMember = useCallback(async (member: any) => {
    if (!currentGroup) return;
    
    try {
      const success = await addGroupMember(currentGroup.id, member.user_id || member.id);
      if (success) {
        setShowAddMember(false);
        // Reload group members to show the new member
        await loadGroupMembers(currentGroup.id);
        Alert.alert('Success', `${member.display_name || 'Member'} added to group`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member to group');
    }
  }, [currentGroup, addGroupMember, loadGroupMembers]);

  // Handle removing member
  const handleRemoveMember = useCallback((member: any) => {
    if (!currentGroup) return;

    // Check if this is a custom location
    if (member.type === 'custom_location') {
      Alert.alert(
        'Remove Location',
        `Are you sure you want to remove "${member.display_name}" from the group?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                // Extract the actual location ID from the member ID
                const locationId = member.id.replace('custom_location_', '');
                const success = await removeCustomLocationFromGroup(locationId);
                if (success) {
                  Alert.alert('Success', 'Custom location removed successfully');
                  // Reload group members to update the list
                  await loadGroupMembers(currentGroup.id);
                }
              } catch (error) {
                console.error('Error removing custom location:', error);
                Alert.alert('Error', 'Failed to remove custom location');
              }
            },
          },
        ]
      );
      return;
    }

    // Handle regular user members
    const isRemovingSelf = member.user_id === user?.uid;
    const actionText = isRemovingSelf ? 'leave' : 'remove';
    const title = isRemovingSelf ? 'Leave Group' : 'Remove Member';
    const message = isRemovingSelf 
      ? 'Are you sure you want to leave this group?'
      : `Are you sure you want to remove ${member.display_name} from the group?`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isRemovingSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await removeGroupMember(currentGroup.id, member.user_id);
              if (success) {
                if (isRemovingSelf) {
                  // Navigate back to groups list if user left the group
                  router.replace('/groups');
                } else {
                  Alert.alert('Success', 'Member removed successfully');
                }
              }
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', `Failed to ${actionText} member`);
            }
          },
        },
      ]
    );
  }, [currentGroup, user, removeGroupMember, removeCustomLocationFromGroup, loadGroupMembers]);

  // Handle reset attendance
  const handleResetAttendance = useCallback(() => {
    if (!currentGroup || !canManageGroup) return;

    Alert.alert(
      'Reset All Attendance',
      'Are you sure you want to reset all attendance for this group? This will remove all current attendance confirmations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await resetGroupAttendance(currentGroup.id);
              if (success) {
                setSuccessMessage('All attendance has been reset');
                // Clear success message after 3 seconds
                setTimeout(() => setSuccessMessage(''), 3000);
              }
            } catch (error) {
              console.error('Error resetting attendance:', error);
              Alert.alert('Error', 'Failed to reset attendance');
            }
          },
        },
      ]
    );
  }, [currentGroup, canManageGroup, resetGroupAttendance]);

  // Handle delete group
  const handleDeleteGroup = useCallback(() => {
    if (!currentGroup || currentGroup.created_by !== user?.uid) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${currentGroup.name}"? This action cannot be undone and will remove the group for all members.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteGroup(currentGroup.id);
              if (success) {
                // Navigate back to groups list
                router.replace('/groups');
              }
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ]
    );
  }, [currentGroup, user, deleteGroup]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <MaterialIcons name="error" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Authentication Required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentGroup && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <MaterialIcons name="group" size={48} color="#9ca3af" />
          <Text style={styles.errorTitle}>Group Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        {editingName ? (
          <View style={styles.headerEditContainer}>
            <TextInput
              style={styles.headerEditInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name"
              maxLength={50}
              autoFocus
              onBlur={handleUpdateName}
            />
            <TouchableOpacity onPress={handleUpdateName}>
              <MaterialIcons name="check" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.headerTitleContainer}
            onPress={() => canManageGroup && setEditingName(true)}
            disabled={!canManageGroup}
          >
            <Text style={styles.headerTitle}>
              {currentGroup?.name || 'Group Settings'}
            </Text>
            {canManageGroup && (
              <MaterialIcons name="edit" size={16} color="#6b7280" style={styles.headerEditIcon} />
            )}
          </TouchableOpacity>
        )}
        <View style={styles.headerPlaceholder} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <MaterialIcons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {successMessage && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{successMessage}</Text>
          <TouchableOpacity onPress={() => setSuccessMessage('')}>
            <MaterialIcons name="close" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        {/* Group Info Section */}
        

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({currentGroupMembers.length})</Text>
            <TouchableOpacity 
              onPress={() => setShowAddMember(!showAddMember)}
              style={styles.addButton}
            >
              <MaterialIcons name="add" size={20} color="#6366f1" />
              <Text style={styles.addButtonText}>Add Member</Text>
            </TouchableOpacity>
          </View>

          {/* Add Member Interface */}
          {showAddMember && (
            <View style={styles.addMemberContainer}>
              <Text style={styles.addMemberLabel}>Add friend or location</Text>
              <AddressInput
                key={`member-add-${memberAddCount}`}
                placeholder="Search for friends or addresses..."
                onPlaceSelected={async (selectedPlace) => {
                  if (selectedPlace.type === 'friend') {
                    // Handle friend selection - add them as a group member
                    const friendMember = {
                      id: selectedPlace.friendId,
                      user_id: selectedPlace.friendId,
                      display_name: selectedPlace.friendName,
                      type: 'user',
                    };
                    await handleAddMember(friendMember);
                  } else {
                    // Handle address selection - add as custom location
                    const customAddress = {
                      display_name: selectedPlace.address.split(',')[0] || 'Custom Location',
                      address: selectedPlace.address,
                      coordinates: [selectedPlace.location.lng, selectedPlace.location.lat],
                      placeId: selectedPlace.placeId,
                      type: 'custom_address',
                      isAttending: true,
                    };
                    
                    // Add custom address to group
                    try {
                      if (currentGroup) {
                        const dbLocation = await addCustomLocationToGroup(currentGroup.id, customAddress);
                        console.log('Custom address added:', dbLocation);
                        // Reload members to get the proper database ID and updated list
                        await loadGroupMembers(currentGroup.id);
                      }
                    } catch (error) {
                      console.error('Error adding custom location:', error);
                      Alert.alert('Error', 'Failed to add custom location');
                    }
                  }
                  
                  // Increment counter to reset the input
                  setMemberAddCount(prev => prev + 1);
                }}
                style={styles.addMemberInput}
              />
              <TouchableOpacity
                style={styles.cancelAddButton}
                onPress={() => setShowAddMember(false)}
              >
                <Text style={styles.cancelAddButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Current Members List */}
          <View style={styles.membersList}>
            {currentGroupMembers.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <View style={[
                    styles.memberAvatar,
                    (member as any).type === 'custom_location' && styles.customLocationAvatar
                  ]}>
                    <MaterialIcons 
                      name={(member as any).type === 'custom_location' ? "place" : "person"} 
                      size={20} 
                      color={(member as any).type === 'custom_location' ? "#f59e0b" : "#6366f1"} 
                    />
                  </View>
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {member.display_name || 'Unknown User'}
                      {member.is_me && ' (You)'}
                    </Text>
                    
                    
                    {/* Attendance Control */}
                    <View style={styles.attendanceContainer}>
                      <SlideToConfirm
                        isAttending={member.attendance?.isAttending || false}
                        onAttendanceChange={async (isAttending) => {
                          try {
                            console.log('Updating attendance for member:', {
                              id: member.id,
                              type: (member as any).type,
                              isAttending
                            });
                            
                            // Check if this is another user (not current user and not custom location)
                            const isAnotherUser = (member as any).type !== 'custom_location' && !member.is_me;
                            
                            if (isAnotherUser) {
                              // Show confirmation alert for other users
                              Alert.alert(
                                'Update Attendance',
                                `Are you sure you want to mark ${member.display_name} as ${isAttending ? 'attending' : 'not attending'}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Update',
                                    onPress: async () => {
                                      await updateUserAttendance(currentGroup.id, member.user_id, isAttending);
                                      // Reload members to get updated attendance
                                      if (currentGroup) {
                                        await loadGroupMembers(currentGroup.id);
                                      }
                                    }
                                  }
                                ]
                              );
                              return;
                            }
                            
                            if ((member as any).type === 'custom_location') {
                              // Handle custom location attendance
                              // Extract the actual database ID from the prefixed ID
                              const actualId = member.id.startsWith('custom_location_') 
                                ? member.id.replace('custom_location_', '') 
                                : member.id;
                              
                              console.log('Custom location ID mapping:', {
                                displayId: member.id,
                                actualId: actualId
                              });
                              
                              await updateCustomLocationAttendance(actualId, isAttending);
                            } else {
                              // Handle user attendance - allow updating any user's attendance
                              await updateUserAttendance(currentGroup.id, member.user_id, isAttending);
                            }
                            // Reload members to get updated attendance
                            if (currentGroup) {
                              await loadGroupMembers(currentGroup.id);
                            }
                          } catch (error) {
                            console.error('Error updating attendance:', error);
                            Alert.alert('Error', 'Failed to update attendance');
                          }
                        }}
                        size="small"
                        confirmText="Attending"
                        cancelText="Not Attending"
                      />
                    </View>
                  </View>
                </View>

                {/* Delete Button */}
                {(canManageGroup || member.is_me) && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      const isCustomLocation = (member as any).type === 'custom_location';
                      const itemName = member.display_name || 'this item';
                      const action = member.is_me ? 'leave' : 'remove';
                      
                      Alert.alert(
                        `${action === 'leave' ? 'Leave' : 'Remove'} ${isCustomLocation ? 'Location' : 'Member'}`,
                        `Are you sure you want to ${action} ${itemName}${member.is_me ? '' : ` from this group`}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: action === 'leave' ? 'Leave' : 'Remove',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                if (isCustomLocation) {
                                  // Extract the actual database ID from the prefixed ID
                                  const actualId = member.id.startsWith('custom_location_') 
                                    ? member.id.replace('custom_location_', '') 
                                    : member.id;
                                  
                                  console.log('Deleting custom location ID mapping:', {
                                    displayId: member.id,
                                    actualId: actualId
                                  });
                                  
                                  await removeCustomLocationFromGroup(actualId);
                                } else {
                                  await handleRemoveMember(member);
                                }
                                // Reload members list
                                if (currentGroup) {
                                  await loadGroupMembers(currentGroup.id);
                                }
                              } catch (error) {
                                console.error('Error removing item:', error);
                                Alert.alert('Error', `Failed to ${action} ${isCustomLocation ? 'location' : 'member'}`);
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <MaterialIcons 
                      name={member.is_me ? "exit-to-app" : "delete"} 
                      size={20} 
                      color="#ef4444" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Member Actions */}
        {canManageGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Actions</Text>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleResetAttendance}
            >
              <MaterialIcons name="refresh" size={20} color="#ef4444" />
              <Text style={styles.dangerButtonText}>Reset All Attendance</Text>
            </TouchableOpacity>
            
            {/* Show delete button only for group creator */}
            {currentGroup?.created_by === user?.uid && (
              <TouchableOpacity
                style={[styles.dangerButton, styles.deleteButton]}
                onPress={handleDeleteGroup}
              >
                <MaterialIcons name="delete-forever" size={20} color="#ef4444" />
                <Text style={styles.dangerButtonText}>Delete Group</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerPlaceholder: {
    width: 40,
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  editableField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#111827',
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customLocationAvatar: {
    backgroundColor: '#fef3c7',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ef4444',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },

  addMemberContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  membersList: {
    // Individual items now have marginBottom instead of gap
  },

  headerEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEditInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#111827',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEditIcon: {
    marginLeft: 4,
  },
  addMemberLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  addMemberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  cancelAddButton: {
    padding: 12,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  attendanceContainer: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 12,
  },
}); 