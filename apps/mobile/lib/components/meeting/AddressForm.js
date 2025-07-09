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
            address: selectedPlace.friendAddress,
            location: selectedPlace.friendLocation
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
    const validAddresses = addresses.filter(addr => 
      addr.value && addr.value.trim() !== '' && (addr.coordinates || addr.friendData)
    );

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
        <Text style={styles.subtitle}>Add addresses and find your perfect meeting spot!</Text>
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
        {/* Add My Address Button */}
      {user && defaultAddress && (
        <View style={styles.myAddressSection}>
          <TouchableOpacity style={styles.myAddressButton} onPress={addMyAddress}>
            <MaterialIcons name="my-location" size={16} color="#a855f7" style={styles.buttonIcon} />
            <Text style={styles.myAddressButtonText}>Add My Address</Text>
          </TouchableOpacity>
          <Text style={styles.myAddressPreview} numberOfLines={1}>
            {defaultAddress.formatted_address}
          </Text>
        </View>
      )}
      {/* Action Buttons - Add Address + Find Meeting Point side by side */}
      <View style={styles.actionButtonsContainer}>
        {/* Add Address Button (Plus Icon Only) */}
              {addresses.length < 5 && (
          <TouchableOpacity style={styles.addAddressIconButton} onPress={addAddress}>
            <MaterialIcons name="add" size={24} color="#a855f7" />
          </TouchableOpacity>
      )}

        {/* Find Meeting Point Button */}
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
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d8b4fe', // More vivid purple border
    marginBottom: 8,
  },
  myAddressButtonText: {
    color: '#8b5cf6', // More vivid purple
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
    marginBottom: 24,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  addAddressIconButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)', // More vivid purple background
    borderRadius: 16,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)', // More vivid purple border
    shadowColor: '#8b5cf6', // More vivid purple shadow
    shadowOffset: {
      width: 0,
      height: 4,
  },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  findMeetingButton: {
    flex: 1,
    backgroundColor: '#8b5cf6', // More vivid purple
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#8b5cf6', // More vivid purple shadow
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  findMeetingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findMeetingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
});

export default AddressForm; 