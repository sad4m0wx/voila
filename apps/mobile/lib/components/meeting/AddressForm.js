import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet
} from 'react-native';
import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AddressInput from '../maps/AddressInput';
import { useAuth } from '../../contexts/AuthContext';
import { useGroups } from '../../contexts/GroupsContext';

const AddressForm = ({
  addresses = [],
  onAddressesChange,
  onFindMeetingPoint,
  isCalculating = false,
  mapBounds = null,
  error = null
}) => {
  const { user, addresses: userAddresses } = useAuth();
  const { createNewGroup } = useGroups();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const router = useRouter();

  // Get user's default address
  const defaultAddress = userAddresses?.find(addr => addr.is_default) || userAddresses?.[0];

  const addAddress = () => {
    if (addresses.length >= 5) {
      // Don't add more than 5 addresses
      return;
    }
    
    // Calculate the next available ID dynamically
    const maxId = addresses.length > 0 ? Math.max(...addresses.map(addr => addr.id)) : 0;
    const nextId = maxId + 1;
    
    const newAddresses = [...addresses, { id: nextId, value: '', coordinates: null }];
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const addMyAddress = () => {
    if (!defaultAddress) {
      Alert.alert(
        'No Address Found',
        'Please add your home address in your profile first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Address', onPress: () => {
            // Navigate to profile or address setup
            Alert.alert('Info', 'Please go to your profile to add your home address.');
          }}
        ]
      );
      return;
    }

    // Check if user's address is already added
    const isAlreadyAdded = addresses.some(addr => 
      addr.value === defaultAddress.formatted_address ||
      (addr.coordinates && 
       Math.abs(addr.coordinates[1] - defaultAddress.latitude) < 0.001 &&
       Math.abs(addr.coordinates[0] - defaultAddress.longitude) < 0.001)
    );

    if (isAlreadyAdded) {
      Alert.alert('Already Added', 'Your address is already in the list.');
      return;
    }

    // Find the first empty address field
    const firstEmptyIndex = addresses.findIndex(addr => !addr.value.trim());
    
    if (firstEmptyIndex !== -1) {
      // Fill the first empty address field
      const newAddresses = addresses.map((addr, index) => 
        index === firstEmptyIndex ? {
          ...addr,
          value: defaultAddress.formatted_address,
          coordinates: [defaultAddress.longitude, defaultAddress.latitude]
        } : addr
      );
      onAddressesChange && onAddressesChange(newAddresses);
    } else {
      // No empty fields, add a new one if under limit
      if (addresses.length >= 5) {
        Alert.alert('Maximum Addresses', 'You can only add up to 5 addresses.');
        return;
      }

      const maxId = addresses.length > 0 ? Math.max(...addresses.map(addr => addr.id)) : 0;
      const nextId = maxId + 1;
      
      const newAddresses = [...addresses, { 
        id: nextId, 
        value: defaultAddress.formatted_address,
        coordinates: [defaultAddress.longitude, defaultAddress.latitude]
      }];
      onAddressesChange && onAddressesChange(newAddresses);
    }
  };

  const createGroup = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to create a group.');
      return;
    }

    // Check if we have at least 2 addresses
    const filledAddresses = addresses.filter(addr => addr.value.trim() && addr.coordinates);
    if (filledAddresses.length < 2) {
      Alert.alert('More Addresses Needed', 'Please add at least 2 addresses to create a group.');
      return;
    }

    Alert.alert(
      'Create Group',
      `Create a group with ${filledAddresses.length} location${filledAddresses.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create', 
          onPress: async () => {
            setIsCreatingGroup(true);
            try {
              // Convert addresses to custom addresses format for the group
              // Exclude the user's own address from custom addresses since they're already a member
              const customAddresses = filledAddresses
                .filter(addr => {
                  // Only exclude if it's exactly the user's default address
                  if (!defaultAddress) return true;
                  
                  return !(
                    addr.value === defaultAddress.formatted_address ||
                    (addr.coordinates && 
                     Math.abs(addr.coordinates[1] - defaultAddress.latitude) < 0.001 &&
                     Math.abs(addr.coordinates[0] - defaultAddress.longitude) < 0.001)
                  );
                })
                .map((addr, index) => ({
                  id: `custom-address-${Date.now()}-${index}`,
                  display_name: addr.value.split(',')[0] || `Location ${index + 1}`,
                  address: addr.value,
                  coordinates: addr.coordinates,
                  placeId: null,
                  type: 'custom_address',
                  isAttending: true
                }));

              // Create group with custom addresses
              const newGroup = await createNewGroup(
                { 
                  name: `Meeting Group - ${new Date().toLocaleDateString()}`,
                  description: 'Created from meeting point search'
                },
                [], // No initial members (just the creator)
                customAddresses
              );

              if (newGroup) {
                Alert.alert(
                  'Group Created!',
                  `Your group "${newGroup.name}" has been created with ${filledAddresses.length} location${filledAddresses.length > 1 ? 's' : ''}.`,
                  [{ 
                    text: 'View Group', 
                    onPress: () => {
                      // Navigate to the group page
                      router.push(`/groups/${newGroup.id}`);
                    }
                  }]
                );
              } else {
                Alert.alert('Error', 'Failed to create group. Please try again.');
              }
            } catch (error) {
              console.error('Error creating group:', error);
              Alert.alert('Error', 'Failed to create group. Please try again.');
            } finally {
              setIsCreatingGroup(false);
            }
          }
        }
      ]
    );
  };

  const removeAddress = (id) => {
    if (addresses.length <= 2) {
      Alert.alert('Error', 'You need at least two addresses');
      return;
    }
    const newAddresses = addresses.filter(addr => addr.id !== id);
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const updateAddress = (id, value) => {
    const newAddresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates: null } : addr
    );
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const updateAddressWithCoordinates = (id, value, coordinates) => {
    const newAddresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates } : addr
    );
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const handlePlaceSelected = (addressId, selectedPlace) => {
    const coordinates = [selectedPlace.location.lng, selectedPlace.location.lat];
    updateAddressWithCoordinates(addressId, selectedPlace.address, coordinates);
  };

  const handleFindMeetingPoint = () => {
    onFindMeetingPoint && onFindMeetingPoint();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Where is everyone?</Text>
        <Text style={styles.subtitle}>Add addresses and find your perfect meeting spot!</Text>
      </View>
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={20} color="#f87171" style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Add My Address Button */}
      {user && defaultAddress && (
        <View style={styles.myAddressSection}>
          <TouchableOpacity style={styles.myAddressButton} onPress={addMyAddress}>
            <MaterialIcons name="my-location" size={16} color="#6366f1" style={styles.buttonIcon} />
            <Text style={styles.myAddressButtonText}>Add My Address</Text>
          </TouchableOpacity>
          <Text style={styles.myAddressPreview} numberOfLines={1}>
            {defaultAddress.formatted_address}
          </Text>
        </View>
      )}
      
      {/* Address List */}
      <View style={styles.addressList}>
        {addresses.map((address, index) => (
          <View key={address.id} style={styles.addressItem}>
            <View style={styles.addressInputContainer}>
              <AddressInput
                value={address.value}
                placeholder={`Address ${index + 1}`}
                bounds={mapBounds}
                onInput={(e) => updateAddress(address.id, e.value)}
                onPlaceSelected={(selectedPlace) => handlePlaceSelected(address.id, selectedPlace)}
              />
            </View>
            {addresses.length > 2 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeAddress(address.id)}
              >
                <MaterialIcons name="close" size={16} color="#f87171" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Add Address Button */}
      {addresses.length < 5 && (
        <View style={styles.addAddressContainer}>
          <TouchableOpacity style={styles.addAddressButton} onPress={addAddress}>
            <MaterialIcons name="add" size={16} color="#6366f1" style={styles.buttonIcon} />
            <Text style={styles.addAddressButtonText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.secondaryButton, isCreatingGroup && styles.buttonDisabled]}
          onPress={createGroup}
          disabled={isCreatingGroup}
        >
          <View style={styles.buttonContent}>
            {isCreatingGroup ? (
              <MaterialIcons name="hourglass-empty" size={14} color="#475569" style={styles.buttonIcon} />
            ) : (
              <FontAwesome5 name="users" size={14} color="#475569" style={styles.buttonIcon} />
            )}
            <Text style={styles.secondaryButtonText}>
              {isCreatingGroup ? 'Creating...' : 'Create Group'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, isCalculating && styles.buttonDisabled]}
          onPress={handleFindMeetingPoint}
          disabled={isCalculating}
        >
          <View style={styles.primaryButtonContent}>
            {isCalculating ? (
              <MaterialIcons name="hourglass-empty" size={14} color="white" style={styles.buttonIcon} />
            ) : (
              <MaterialIcons name="place" size={14} color="white" style={styles.buttonIcon} />
            )}
            <Text style={styles.primaryButtonText}>
              {isCalculating ? 'Finding...' : 'Find Meeting Point'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f87171',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  myAddressSection: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  myAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8faff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    marginBottom: 8,
  },
  myAddressButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  myAddressPreview: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  addressList: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressInputContainer: {
    flex: 1,
    marginRight: 12,
  },
  removeButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  addAddressContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addAddressButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
});

export default AddressForm; 