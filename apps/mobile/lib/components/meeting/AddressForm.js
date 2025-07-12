import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AddressInput from '../maps/AddressInput';
import { AddressPicker } from '../utils';
import { useAuth } from '../../contexts/AuthContext';
import { useGroups } from '../../contexts/GroupsContext';
import { GradientView } from '../core';

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
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const router = useRouter();

  // Get user's default address
  const defaultAddress = userAddresses?.find(addr => addr.is_default) || userAddresses?.[0];

  const addAddress = () => {
    if (addresses.length >= 3) {
      // Show alert when user tries to add more than 5 addresses
      Alert.alert(
        'Maximum Addresses',
        'You can only add up to 5 addresses. Create a group to manage more locations!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Group', onPress: () => {
            router.push('/groups');
          }}
        ]
      );
      return;
    }
    
    // Calculate the next available ID dynamically
    const maxId = addresses.length > 0 ? Math.max(...addresses.map(addr => addr.id)) : 0;
    const nextId = maxId + 1;
    
    const newAddresses = [...addresses, { id: nextId, value: '', coordinates: null }];
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const addMyAddress = () => {
    if (!userAddresses || userAddresses.length === 0) {
      Alert.alert(
        'No Saved Addresses',
        'Please add addresses in your profile first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Address', onPress: () => {
            Alert.alert('Info', 'Please go to your profile to add your addresses.');
          }}
        ]
      );
      return;
    }

    setShowAddressPicker(true);
  };

  const handleAddressSelected = (selectedAddress) => {
    // Check if this address is already added
    const isAlreadyAdded = addresses.some(addr => 
      addr.value === selectedAddress.address ||
      (addr.coordinates && 
       Math.abs(addr.coordinates[1] - selectedAddress.coordinates[1]) < 0.001 &&
       Math.abs(addr.coordinates[0] - selectedAddress.coordinates[0]) < 0.001)
    );

    if (isAlreadyAdded) {
      Alert.alert('Already Added', 'This address is already in the list.');
      return;
    }

    // Find the first empty address field
    const firstEmptyIndex = addresses.findIndex(addr => !addr.value.trim());
    
    if (firstEmptyIndex !== -1) {
      // Fill the first empty address field
      const newAddresses = addresses.map((addr, index) => 
        index === firstEmptyIndex ? {
          ...addr,
          value: selectedAddress.address,
          coordinates: selectedAddress.coordinates
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
        value: selectedAddress.address,
        coordinates: selectedAddress.coordinates
      }];
      onAddressesChange && onAddressesChange(newAddresses);
    }
  };

  const removeAddress = (id) => {
    // Don't allow removing if less than 2 addresses would remain
    if (addresses.length <= 2) return;
    
    const newAddresses = addresses.filter(addr => addr.id !== id);
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const updateAddress = (id, value) => {
    const newAddresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value } : addr
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
    if (selectedPlace.type === 'friend') {
      // Handle friend selection
      const newAddresses = addresses.map(addr => 
        addr.id === addressId ? { 
          ...addr, 
          value: selectedPlace.friendName, 
          coordinates: null, // Will be handled by the parent component
          friendData: {
            id: selectedPlace.friendId,
            name: selectedPlace.friendName,
            address: selectedPlace.address,
            location: selectedPlace.location
          }
        } : addr
      );
      onAddressesChange && onAddressesChange(newAddresses);
    } else {
      // Handle regular address selection
      updateAddressWithCoordinates(
        addressId, 
        selectedPlace.address, 
        [selectedPlace.location.lng, selectedPlace.location.lat]
      );
    }
  };

  const handleFindMeetingPoint = () => {
    // Check if we have at least 2 valid addresses
    const validAddresses = addresses.filter(addr => {
      if (!addr.value || addr.value.trim() === '') return false;
      
      if (addr.coordinates) return true;
      
      if (addr.friendData && addr.friendData.location) {
        return addr.friendData.location.lat && addr.friendData.location.lng;
      }
      
      return false;
    });

    if (validAddresses.length < 2) {
      Alert.alert(
        'Not enough addresses',
        'Please enter at least 2 valid addresses to find a meeting point.'
      );
      return;
    }

    onFindMeetingPoint && onFindMeetingPoint();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Where is everyone?</Text>
        <Text style={styles.subtitle}>Find your perfect meeting spot!</Text>
      </View>
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={20} color="#f87171" style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      
      
      {/* Address List */}
      <View style={styles.addressList}>
        {addresses.map((address, index) => (
          <View key={address.id} style={styles.addressItem}>
            <View style={styles.addressInputContainer}>
              <AddressInput
                value={address.value}
                placeholder={`Add a friend or a custom address`}
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
        {/* Add My Address Button */}
      {user && userAddresses && userAddresses.length > 0 && (
        <View style={styles.myAddressSection}>
          <TouchableOpacity style={styles.myAddressButton} onPress={addMyAddress}>
            <MaterialIcons name="my-location" size={16} color="#a855f7" style={styles.buttonIcon} />
            <Text style={styles.myAddressButtonText}>Add My Address</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Action Buttons - Add Address + Find Meeting Point side by side */}
      <View style={styles.actionButtonsContainer}>
        {/* Add Address Button (Plus Icon Only) */}
        <GradientView gradientName="sunsetOrange" style={styles.addAddressIconButton}>
          <TouchableOpacity style={styles.addAddressIconButton} onPress={addAddress}>
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        </GradientView>

        {/* Find Meeting Point Button */}
        <GradientView gradientName="greenEmerald" style={styles.findMeetingButton}>
        <TouchableOpacity
          style={[styles.findMeetingButton, isCalculating && styles.buttonDisabled]}
          onPress={handleFindMeetingPoint}
          disabled={isCalculating}
        >
          <View style={styles.findMeetingButtonContent}>
            {isCalculating ? (
              <MaterialIcons name="hourglass-empty" size={18} color="white" style={styles.buttonIcon} />
            ) : (
              <MaterialIcons name="place" size={18} color="white" style={styles.buttonIcon} />
            )}
            <Text style={styles.findMeetingButtonText}>
              {isCalculating ? 'Finding...' : 'Find Meeting Point'}
            </Text>
          </View>
        </TouchableOpacity>
        </GradientView>
      </View>

      {/* Address Picker Modal */}
      <AddressPicker
        visible={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onSelectAddress={handleAddressSelected}
        title="Select Your Address"
        emptyMessage="You don't have any saved addresses yet."
        actionMessage="Add addresses in your profile to see them here."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f87171',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
  myAddressSection: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  myAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  myAddressButtonText: {
    color: '#8b5cf6',
    fontSize: 13,
    fontWeight: '600',
  },
  addressList: {
    marginBottom: 0,
    paddingHorizontal: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressInputContainer: {
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    width: 28,
    height: 28,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  addAddressIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findMeetingButton: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findMeetingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findMeetingButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default AddressForm; 