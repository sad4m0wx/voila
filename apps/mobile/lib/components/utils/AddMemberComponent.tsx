import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { contactService } from '../../services/contactService';
import { useGroups } from '../../contexts/GroupsContext';
import { normalizePhoneNumber } from '../../utils/phoneUtils';
import { AddressInput } from '../maps';
import SlideToConfirm from './SlideToConfirm';

interface AddMemberComponentProps {
  onAddMember?: (member: any) => void;
  onAddCustomAddress?: (address: any) => void;
  existingMembers?: any[];
  groupId?: string;
  style?: any;
}

export function AddMemberComponent({
  onAddMember,
  onAddCustomAddress,
  existingMembers = [],
  groupId,
  style,
}: AddMemberComponentProps) {
  const { findUsersByPhoneNumbers, addCustomLocationToGroup, getGroupCustomLocations, updateCustomLocationAttendance, removeCustomLocationFromGroup } = useGroups();
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [unregisteredContacts, setUnregisteredContacts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCustomAddressInput, setShowCustomAddressInput] = useState(false);
  const [selectedCustomAddress, setSelectedCustomAddress] = useState(null);
  const [customAddresses, setCustomAddresses] = useState([]);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
    if (groupId) {
      loadGroupCustomLocations();
    }
  }, []);

  // Load existing custom locations for the group
  const loadGroupCustomLocations = async () => {
    if (!groupId) return;
    
    try {
      const locations = await getGroupCustomLocations(groupId);
      const formattedLocations = locations.map(location => ({
        id: location.id,
        display_name: location.name,
        address: location.address,
        coordinates: [location.longitude, location.latitude],
        placeId: location.place_id,
        type: 'custom_address',
        isAttending: location.is_attending,
      }));
      setCustomAddresses(formattedLocations);
    } catch (error) {
      console.error('Error loading group custom locations:', error);
    }
  };

  // Test phone number normalization
  useEffect(() => {
    const testCases = [
      '0602039126',
      '+33602039126', 
      '602039126',
      '+33 6 02 03 91 26',
      '06 02 03 91 26'
    ];
    
    testCases.forEach(phone => {
      const normalized = normalizePhoneNumber(phone);
    });
  }, []);

  const loadContacts = async () => {
    try {
      // Check permission status
      const permissionStatus = await contactService.getPermissionStatus();
      
      if (permissionStatus !== 'granted') {
        const granted = await contactService.showPermissionDialog();
        if (!granted) return;
      }

      // Load contacts
      await contactService.loadContacts();
      
      // Use the already normalized phone numbers from contactService
      const allPhones = contactService.contacts.flatMap(contact => 
        contact.phoneNumbers.map(phone => {
          return phone.normalized;
        })
      ).filter(phone => phone); // Remove empty phones

      // Find which contacts are registered users
      const registeredData = await findUsersByPhoneNumbers(allPhones);
      
      // Create map of registered phone numbers to user data
      const registeredPhoneMap = new Map();
      registeredData.forEach(user => {
        registeredPhoneMap.set(user.phone_number, user);
      });

      // Separate registered and unregistered contacts
      const registered = [];
      const unregistered = [];

      contactService.contacts.forEach(contact => {
        let matchedUserData = null;
        
        // Check each phone number in the contact
        for (const phoneObj of contact.phoneNumbers) {
          // Use the already normalized phone from contactService
          if (registeredPhoneMap.has(phoneObj.normalized)) {
            matchedUserData = registeredPhoneMap.get(phoneObj.normalized);
            break;
          }
        }

        if (matchedUserData) {
          // Skip if already a member
          if (!existingMembers.find(m => m.user_id === matchedUserData.id)) {
            registered.push({
              ...contact,
              userData: matchedUserData,
              type: 'registered',
              isRegistered: true,
            });
          }
        } else {
          unregistered.push({
            ...contact,
            type: 'contact',
            isRegistered: false,
          });
        }
      });

      setRegisteredUsers(registered);
      setUnregisteredContacts(unregistered);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  // Filter contacts based on search term (name only)
  const filteredContacts = useCallback(() => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase().trim();
    
    // Filter registered users by name
    const filteredRegistered = registeredUsers.filter(contact =>
      contact.name.toLowerCase().includes(term) ||
      contact.firstName.toLowerCase().includes(term) ||
      contact.lastName.toLowerCase().includes(term)
    );

    // Filter unregistered contacts by name
    const filteredUnregistered = unregisteredContacts.filter(contact =>
      contact.name.toLowerCase().includes(term) ||
      contact.firstName.toLowerCase().includes(term) ||
      contact.lastName.toLowerCase().includes(term)
    );

    // Return registered users first, then unregistered
    return [...filteredRegistered, ...filteredUnregistered];
  }, [searchTerm, registeredUsers, unregisteredContacts]);

  const handleAddMember = (contact) => {
    if (contact.isRegistered && contact.userData) {
      // Add registered user
      const member = {
        id: contact.userData.id,
        user_id: contact.userData.id,
        display_name: contact.userData.display_name,
        phone_number: contact.userData.phone_number,
        type: 'user',
      };
      onAddMember?.(member);
    } else {
      // Handle unregistered contact invitation
      Alert.alert(
        'Invite Contact',
        `Send invitation to ${contact.name}? They will be added to the group once they join the app.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send Invite', 
            onPress: () => {
              const inviteMember = {
                id: `invite-${contact.id}`,
                display_name: contact.name,
                phone_number: contact.phoneNumbers[0]?.number,
                type: 'invite',
                isRegistered: false,
              };
              onAddMember?.(inviteMember);
              Alert.alert('Invite Sent', `Invitation sent to ${contact.name}`);
            }
          }
        ]
      );
    }
    setSearchTerm('');
  };

  const handleAddCustomAddress = async () => {
    if (!selectedCustomAddress) {
      Alert.alert('Error', 'Please select an address');
      return;
    }

    const customAddressItem = {
      id: `custom-address-${Date.now()}`,
      display_name: selectedCustomAddress.address,
      address: selectedCustomAddress.address,
      coordinates: [selectedCustomAddress.location.lng, selectedCustomAddress.location.lat],
      placeId: selectedCustomAddress.placeId,
      type: 'custom_address',
      isAttending: true, // Default to true
    };

    try {
      // If groupId is provided, save to database
      if (groupId) {
        const dbLocation = await addCustomLocationToGroup(groupId, customAddressItem);
        if (dbLocation) {
          // Update with database ID
          customAddressItem.id = dbLocation.id;
        } else {
          console.error('❌ Failed to save custom location to database');
        }
      }

      // Add to local custom addresses list
      setCustomAddresses(prev => [...prev, customAddressItem]);
      
      // Call the callback
      onAddCustomAddress?.(customAddressItem);
      
      setSelectedCustomAddress(null);
      setShowCustomAddressInput(false);
      
      Alert.alert('Success', 'Custom location added successfully');
    } catch (error) {
      console.error('Error adding custom location:', error);
      Alert.alert('Error', 'Failed to add custom location');
    }
  };

  const handleRemoveCustomAddress = async (addressId) => {
    try {
      // Remove from database if it's a database record (not local-only)
      if (groupId && !addressId.startsWith('custom-address-')) {
        await removeCustomLocationFromGroup(addressId);
      }
      
      // Update local state
      setCustomAddresses(prev => prev.filter(addr => addr.id !== addressId));
    } catch (error) {
      console.error('Error removing custom location:', error);
      Alert.alert('Error', 'Failed to remove custom location');
    }
  };

  const handleCustomAddressAttendanceChange = async (addressId, isAttending) => {
    try {
      // Update in database if it's a database record (not local-only)
      if (groupId && !addressId.startsWith('custom-address-')) {
        await updateCustomLocationAttendance(addressId, isAttending);
      }
      
      // Update local state
      setCustomAddresses(prev => 
        prev.map(addr => 
          addr.id === addressId ? { ...addr, isAttending } : addr
        )
      );
    } catch (error) {
      console.error('Error updating custom location attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    }
  };

  const displayedContacts = filteredContacts();

  return (
    <View style={[styles.container, style]}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search contacts by name..."
          placeholderTextColor="#9ca3af"
        />
        {searching && (
          <ActivityIndicator size="small" color="#6366f1" />
        )}
      </View>

      {/* Search Results */}
      {searchTerm.trim() && displayedContacts.length > 0 && (
        <ScrollView style={styles.searchResults} nestedScrollEnabled>
          {displayedContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              onPress={() => handleAddMember(contact)}
            >
              <View style={styles.contactInfo}>
                <View style={[
                  styles.contactAvatar,
                  contact.isRegistered && styles.registeredAvatar
                ]}>
                  <MaterialIcons 
                    name={contact.isRegistered ? "person" : "person-outline"} 
                    size={20} 
                    color={contact.isRegistered ? "#10b981" : "#6b7280"} 
                  />
                </View>
                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>
                    {contact.phoneNumbers[0]?.number}
                  </Text>
                  {contact.isRegistered && (
                    <Text style={styles.registeredText}>Has account</Text>
                  )}
                </View>
              </View>
              <View style={[
                styles.actionButton,
                contact.isRegistered && styles.registeredActionButton
              ]}>
                <MaterialIcons 
                  name={contact.isRegistered ? "add" : "person-add"} 
                  size={16} 
                  color={contact.isRegistered ? "#10b981" : "#6366f1"} 
                />
                <Text style={[
                  styles.actionButtonText,
                  contact.isRegistered && styles.registeredActionText
                ]}>
                  {contact.isRegistered ? 'Add' : 'Invite'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* No Results */}
      {searchTerm.trim() && displayedContacts.length === 0 && (
        <View style={styles.noResults}>
          <MaterialIcons name="person-search" size={48} color="#9ca3af" />
          <Text style={styles.noResultsTitle}>No contacts found</Text>
          <Text style={styles.noResultsDescription}>
            Try searching with a different name
          </Text>
        </View>
      )}

      {/* Custom Address Toggle */}
      <TouchableOpacity 
        style={styles.customAddressToggle}
        onPress={() => setShowCustomAddressInput(!showCustomAddressInput)}
      >
        <MaterialIcons name="place" size={20} color="#6366f1" />
        <Text style={styles.customAddressToggleText}>Add Custom Location</Text>
        <MaterialIcons 
          name={showCustomAddressInput ? "expand-less" : "add"} 
          size={20} 
          color="#6366f1" 
        />
      </TouchableOpacity>

      {/* Custom Address Input */}
      {showCustomAddressInput && (
        <View style={styles.customAddressContainer}>
          <Text style={styles.customAddressLabel}>Add Custom Location</Text>
          <AddressInput
            value={selectedCustomAddress?.address || ''}
            placeholder="Search for an address..."
            onPlaceSelected={setSelectedCustomAddress}
          />
          <View style={styles.customAddressActions}>
            <TouchableOpacity
              style={styles.customAddressCancel}
              onPress={() => {
                setSelectedCustomAddress(null);
                setShowCustomAddressInput(false);
              }}
            >
              <Text style={styles.customAddressCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.customAddressAdd,
                !selectedCustomAddress && styles.customAddressAddDisabled
              ]}
              onPress={handleAddCustomAddress}
              disabled={!selectedCustomAddress}
            >
              <MaterialIcons name="add" size={16} color="#ffffff" />
              <Text style={styles.customAddressAddText}>Add Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom Addresses List */}
      {customAddresses.length > 0 && (
        <View style={styles.customAddressList}>
          <Text style={styles.customAddressListTitle}>Custom Locations</Text>
          {customAddresses.map((address) => (
            <View key={address.id} style={styles.customAddressItem}>
              <View style={styles.customAddressHeader}>
                <View style={styles.customAddressInfo}>
                  <MaterialIcons name="place" size={20} color="#6366f1" />
                  <Text style={styles.customAddressText} numberOfLines={2}>
                    {address.address}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveCustomAddress(address.id)}
                  style={styles.removeCustomAddressButton}
                >
                  <MaterialIcons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <View style={styles.customAddressAttendance}>
                <SlideToConfirm
                  isAttending={address.isAttending}
                  onAttendanceChange={(isAttending) => 
                    handleCustomAddressAttendanceChange(address.id, isAttending)
                  }
                  label="Will attend from this location"
                  size="small"
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  searchResults: {
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactAvatar: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  registeredAvatar: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  contactPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  registeredText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  registeredActionButton: {
    backgroundColor: '#ecfdf5',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  registeredActionText: {
    color: '#10b981',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  noResultsDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  customAddressToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
    marginBottom: 12,
  },
  customAddressToggleText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#6366f1',
  },
  customAddressContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  customAddressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  customAddressActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  customAddressCancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 10,
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
    paddingVertical: 10,
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
  customAddressList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  customAddressListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  customAddressItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
    marginBottom: 12,
  },
  customAddressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  customAddressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
  },
  customAddressText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  removeCustomAddressButton: {
    padding: 4,
  },
  customAddressAttendance: {
    paddingLeft: 28,
  },
});

export default AddMemberComponent; 