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
import AddressInput from '../maps/AddressInput';

const AddressForm = ({
  addresses = [],
  onAddressesChange,
  onFindMeetingPoint,
  isCalculating = false,
  mapBounds = null,
  error = null
}) => {
  let nextId = 3;

  const addAddress = () => {
    if (addresses.length >= 5) {
      // Don't add more than 5 addresses
      return;
    }
    const newAddresses = [...addresses, { id: nextId, value: '', coordinates: null }];
    nextId += 1;
    onAddressesChange && onAddressesChange(newAddresses);
  };

  const createGroup = () => {
    Alert.alert(
      'Create Group',
      'Group creation will be implemented in the next phase.',
      [{ text: 'OK' }]
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
        <Text style={styles.title}>Where would you like to meet?</Text>
        <Text style={styles.subtitle}>Add at least 2 addresses to find the perfect meeting spot</Text>
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

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {addresses.length >= 5 ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={createGroup}>
            <FontAwesome5 name="users" size={14} color="#475569" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Create a Group</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={addAddress}>
            <MaterialIcons name="add" size={16} color="#6366f1" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Add Address</Text>
          </TouchableOpacity>
        )}

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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b', // Darker slate
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b', // Slate
    textAlign: 'center',
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
  addressList: {
    marginBottom: 16,
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
  buttonContainer: {
    gap: 10,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonIcon: {
    marginRight: 6,
  },
  secondaryButtonText: {
    color: '#475569', // Slate
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#6366f1', // Indigo
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
});

export default AddressForm; 