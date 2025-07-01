import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/contexts/AuthContext';
import { AddressInput } from '../lib/components/maps';
import { LoadingIndicator } from '../lib/components/utils';

const ADDRESS_TAGS = [
  { key: 'home', label: 'Home', icon: 'home', color: '#6366f1' },
  { key: 'work', label: 'Work', icon: 'work', color: '#059669' },
  { key: 'other', label: 'Other', icon: 'place', color: '#dc2626' }
];

const MAX_ADDRESSES = 3;

export default function ProfileScreen() {
  const { user, profile, addresses, createAddress, updateAddress, deleteAddress, loadUserAddresses, logout } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [selectedTag, setSelectedTag] = useState('home');
  const [selectedAddress, setSelectedAddress] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadUserAddresses(user.uid);
    }
  }, [user?.uid, loadUserAddresses]);

  const getTagInfo = (tag) => {
    return ADDRESS_TAGS.find(t => t.key === tag) || ADDRESS_TAGS[0];
  };

  const getAvailableTags = () => {
    const usedTags = addresses.map(addr => addr.tag);
    return ADDRESS_TAGS.filter(tag => !usedTags.includes(tag.key));
  };

  const handleAddAddress = () => {
    const availableTags = getAvailableTags();
    if (availableTags.length === 0) {
      Alert.alert('Maximum Addresses', 'You can only have 3 addresses (one for each tag).');
      return;
    }
    setSelectedTag(availableTags[0].key);
    setEditingAddress(null);
    setSelectedAddress(null);
    setShowAddModal(true);
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setSelectedTag(address.tag);
    setSelectedAddress({
      address: address.formatted_address,
      location: {
        lat: address.latitude,
        lng: address.longitude
      },
      placeId: address.place_id
    });
    setShowAddModal(true);
  };

  const handleSaveAddress = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select an address.');
      return;
    }

    setIsLoading(true);
    
    try {
      const addressData = {
        name: getTagInfo(selectedTag).label,
        formatted: selectedAddress.address,
        coordinates: {
          lat: selectedAddress.location.lat,
          lng: selectedAddress.location.lng
        },
        placeId: selectedAddress.placeId,
        tag: selectedTag,
        isDefault: selectedTag === 'home'
      };

      let result;
      if (editingAddress) {
        result = await updateAddress(editingAddress.id, addressData);
      } else {
        result = await createAddress(addressData);
      }

      if (result.success) {
        setShowAddModal(false);
        setSelectedAddress(null);
        setEditingAddress(null);
        // Reload addresses
        await loadUserAddresses(user.uid);
      } else {
        Alert.alert('Error', result.error || 'Failed to save address.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = (address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete your ${getTagInfo(address.tag).label} address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAddress(address.id);
            if (result.success) {
              await loadUserAddresses(user.uid);
            } else {
              Alert.alert('Error', result.error || 'Failed to delete address.');
            }
          }
        }
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to sign out.');
            }
          }
        }
      ]
    );
    router.push('/');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialIcons name="account-circle" size={80} color="#9ca3af" />
          <Text style={styles.emptyStateText}>Please sign in to view your profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Navigation Header */}
        <View style={styles.navigationHeader}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.navigationTitle}>Profile</Text>
          <View style={styles.navigationSpacer} />
        </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <MaterialIcons name="account-circle" size={60} color="#6366f1" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {profile?.display_name || 'User'}
              </Text>
              <Text style={styles.userPhone}>
                {user.phoneNumber || 'No phone number'}
              </Text>
            </View>
          </View>
        </View>

        {/* Addresses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Addresses</Text>
            <Text style={styles.sectionSubtitle}>
              {addresses.length}/{MAX_ADDRESSES} addresses
            </Text>
          </View>

          {/* Address List */}
          {addresses.map((address) => {
            const tagInfo = getTagInfo(address.tag);
            return (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <View style={styles.addressTag}>
                    <MaterialIcons 
                      name={tagInfo.icon} 
                      size={20} 
                      color={tagInfo.color} 
                    />
                    <Text style={[styles.addressTagText, { color: tagInfo.color }]}>
                      {tagInfo.label}
                    </Text>
                  </View>
                  <View style={styles.addressActions}>
                    <TouchableOpacity 
                      onPress={() => handleEditAddress(address)}
                      style={styles.actionButton}
                    >
                      <MaterialIcons name="edit" size={20} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDeleteAddress(address)}
                      style={styles.actionButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.addressText} numberOfLines={2}>
                  {address.formatted_address}
                </Text>
              </View>
            );
          })}

          {/* Add Address Button */}
          {addresses.length < MAX_ADDRESSES && (
            <TouchableOpacity 
              style={styles.addAddressButton}
              onPress={handleAddAddress}
            >
              <MaterialIcons name="add" size={24} color="#6366f1" />
              <Text style={styles.addAddressText}>Add Address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionItem} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={24} color="#dc2626" />
            <Text style={[styles.actionText, { color: '#dc2626' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowAddModal(false)}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Edit Address' : 'Add Address'}
            </Text>
            <TouchableOpacity 
              onPress={handleSaveAddress}
              style={[styles.modalSaveButton, (!selectedAddress || isLoading) && styles.modalSaveButtonDisabled]}
              disabled={!selectedAddress || isLoading}
            >
              {isLoading ? (
                <LoadingIndicator size="small" color="#6366f1" />
              ) : (
                <Text style={styles.modalSaveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Tag Selection */}
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionTitle}>Address Type</Text>
              <View style={styles.tagList}>
                {ADDRESS_TAGS.map((tag) => {
                  const isUsed = !editingAddress && addresses.some(addr => addr.tag === tag.key);
                  const isSelected = selectedTag === tag.key;
                  const isDisabled = isUsed && !isSelected;
                  
                  return (
                    <TouchableOpacity
                      key={tag.key}
                      style={[
                        styles.tagOption,
                        isSelected && styles.tagOptionSelected,
                        isDisabled && styles.tagOptionDisabled
                      ]}
                      onPress={() => !isDisabled && setSelectedTag(tag.key)}
                      disabled={isDisabled}
                    >
                      <MaterialIcons 
                        name={tag.icon} 
                        size={20} 
                        color={isDisabled ? '#9ca3af' : (isSelected ? '#ffffff' : tag.color)} 
                      />
                      <Text style={[
                        styles.tagOptionText,
                        isSelected && styles.tagOptionTextSelected,
                        isDisabled && styles.tagOptionTextDisabled
                      ]}>
                        {tag.label}
                      </Text>
                      {isUsed && !isSelected && (
                        <Text style={styles.tagUsedText}>Used</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Address Input */}
            <View style={styles.addressSection}>
              <Text style={styles.addressSectionTitle}>Address</Text>
              <AddressInput
                value={selectedAddress?.address || ''}
                placeholder="Enter your address"
                onPlaceSelected={setSelectedAddress}
                style={styles.addressInput}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  navigationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  navigationSpacer: {
    width: 40, // Same width as back button to center title
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressTagText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  addressActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8faff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addAddressText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tagSection: {
    marginTop: 24,
  },
  tagSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  tagList: {
    gap: 8,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  tagOptionSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  tagOptionDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  tagOptionText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  tagOptionTextSelected: {
    color: '#ffffff',
  },
  tagOptionTextDisabled: {
    color: '#9ca3af',
  },
  tagUsedText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  addressSection: {
    marginTop: 24,
  },
  addressSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addressInput: {
    borderRadius: 12,
  },
}); 