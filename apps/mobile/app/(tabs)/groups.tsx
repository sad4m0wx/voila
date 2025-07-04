import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../lib/contexts/AuthContext';
import { useGroups } from '../../lib/contexts/GroupsContext';
import { router } from 'expo-router';
import { contactService } from '../../lib/services/contactService';
import { AddressInput } from '../../lib/components/maps';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface GroupCardProps {
  group: Group;
  onPress: () => void;
}

function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress}>
      <View style={styles.groupCardHeader}>
        <View style={styles.groupIconContainer}>
          <MaterialIcons name="group" size={24} color="#6366f1" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, memberIds: string[], customAddresses?: any[]) => Promise<void>;
  isLoading: boolean;
}

function CreateGroupModal({ visible, onClose, onCreateGroup, isLoading }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [customAddresses, setCustomAddresses] = useState<any[]>([]);

  const handleAddMember = (member: any) => {
    if (selectedMembers.find(m => m.id === member.id)) return;
    setSelectedMembers(prev => [...prev, member]);
  };

  const handleAddCustomAddress = (address: any) => {
    setCustomAddresses(prev => [...prev, address]);
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== userId));
  };

  const handleRemoveCustomAddress = (addressId: string) => {
    setCustomAddresses(prev => prev.filter(addr => addr.id !== addressId));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      // Only pass actual user IDs to group creation
      const userMemberIds = selectedMembers
        .filter(m => m.type === 'user' || m.type === 'registered')
        .map(m => m.user_id || m.id);
      
      await onCreateGroup(groupName.trim(), userMemberIds, customAddresses);
      handleClose();
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedMembers([]);
    setCustomAddresses([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} disabled={isLoading}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Group</Text>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={isLoading || !groupName.trim()}
              style={[
                styles.modalCreateButton,
                (!groupName.trim() || isLoading) && styles.modalCreateButtonDisabled
              ]}
            >
              <Text style={[
                styles.modalCreateButtonText,
                (!groupName.trim() || isLoading) && styles.modalCreateButtonTextDisabled
              ]}>
                {isLoading ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                maxLength={50}
                editable={!isLoading}
                autoFocus
              />
            </View>

            {/* Selected Members */}
            {(selectedMembers.length > 0 || customAddresses.length > 0) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Selected ({selectedMembers.length + customAddresses.length})
                </Text>
                <View style={styles.selectedMembersList}>
                  {selectedMembers.map((member) => (
                    <View key={member.id} style={styles.selectedMemberCard}>
                      <View style={styles.selectedMemberInfo}>
                        <MaterialIcons 
                          name={
                            member.type === 'contact' ? "email" : "person"
                          } 
                          size={16} 
                          color="#6366f1" 
                          style={styles.selectedMemberIcon}
                        />
                        <Text style={styles.selectedMemberName}>
                          {member.display_name || member.phone_number}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(member.id)}
                        style={styles.removeMemberButton}
                      >
                        <MaterialIcons name="close" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {customAddresses.map((address) => (
                    <View key={address.id} style={styles.selectedMemberCard}>
                      <View style={styles.selectedMemberInfo}>
                        <MaterialIcons 
                          name="place" 
                          size={16} 
                          color="#6366f1" 
                          style={styles.selectedMemberIcon}
                        />
                        <Text style={styles.selectedMemberName}>
                          {address.address}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveCustomAddress(address.id)}
                        style={styles.removeMemberButton}
                      >
                        <MaterialIcons name="close" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Add Members Component */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Add friends and locations</Text>
              <AddressInput
                key={`address-input-${selectedMembers.length + customAddresses.length}`}
                placeholder="Search for friends or addresses..."
                onPlaceSelected={(selectedPlace) => {
                  if (selectedPlace.type === 'friend') {
                    // Handle friend selection
                    const friendMember = {
                      id: selectedPlace.friendId,
                      user_id: selectedPlace.friendId,
                      display_name: selectedPlace.friendName,
                      type: 'user',
                    };
                    handleAddMember(friendMember);
                  } else {
                    // Handle address selection
                    const customAddress = {
                      id: `custom-address-${Date.now()}`,
                      display_name: selectedPlace.address.split(',')[0] || 'Custom Location',
                      address: selectedPlace.address,
                      coordinates: [selectedPlace.location.lng, selectedPlace.location.lat],
                      placeId: selectedPlace.placeId,
                      type: 'custom_address',
                      isAttending: true,
                    };
                    handleAddCustomAddress(customAddress);
                  }
                }}
                style={styles.addMemberInput}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function GroupsScreen() {
  const { user, isFullyOnboarded } = useAuth();
  const {
    groups,
    loading,
    error,
    loadUserGroups,
    createNewGroup,
    clearError,
  } = useGroups();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load groups when component mounts or user changes
  useEffect(() => {
    if (user && isFullyOnboarded) {
      loadUserGroups();
    }
  }, [user, isFullyOnboarded, loadUserGroups]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserGroups();
    } finally {
      setRefreshing(false);
    }
  }, [loadUserGroups]);

  // Handle group creation
  const handleCreateGroup = useCallback(async (name: string, memberIds: string[], customAddresses: any[] = []) => {
    setIsCreating(true);
    try {
      const newGroup = await createNewGroup(
        { name },
        memberIds,
        customAddresses
      );
      
      if (newGroup) {
        // Navigate to the new group
        router.push(`/groups/${newGroup.id}`);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [createNewGroup]);

  // Handle group press
  const handleGroupPress = useCallback((group: Group) => {
    router.push(`/groups/${group.id}`);
  }, []);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      if (error) {
        clearError();
      }
    };
  }, [error, clearError]);

  // If user is not authenticated, show sign-in prompt
  if (!user || !isFullyOnboarded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialIcons name="group" size={64} color="#6366f1" />
          <Text style={styles.emptyTitle}>Groups</Text>
          <Text style={styles.emptyDescription}>
            Sign in and complete your profile to create and manage groups with your friends!
          </Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <MaterialIcons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <MaterialIcons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {groups.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="group-add" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No Groups Yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first group to start planning meetups with friends!
          </Text>
          <TouchableOpacity
            style={styles.createFirstGroupButton}
            onPress={() => setShowCreateModal(true)}
          >
            <MaterialIcons name="add" size={20} color="#ffffff" />
            <Text style={styles.createFirstGroupButtonText}>Create First Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={() => handleGroupPress(item)}
            />
          )}
          contentContainerStyle={styles.groupsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateGroup={handleCreateGroup}
        isLoading={isCreating}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  createButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  groupsList: {
    padding: 24,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIconContainer: {
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  groupCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  groupDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  signInButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createFirstGroupButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createFirstGroupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCreateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  modalCreateButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  modalCreateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalCreateButtonTextDisabled: {
    color: '#9ca3af',
  },
  modalForm: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
  selectedMembersList: {
    gap: 8,
  },
  selectedMemberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedMemberIcon: {
    marginRight: 8,
  },
  selectedMemberName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  removeMemberButton: {
    padding: 4,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  searchResults: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  searchResultPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  customAddressToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customAddressToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    marginLeft: 8,
  },
  customAddressContainer: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customAddressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  customAddressActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  customAddressCancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  customAddressCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customAddressAdd: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  customAddressAddDisabled: {
    backgroundColor: '#d1d5db',
  },
  customAddressAddText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  addMemberInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
}); 