import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useAuth } from '../../contexts/AuthContext';
import { AddressInput } from '../../components/maps';
import LoadingIndicator from '../utils/LoadingIndicator';

// Name Setup Screen
export function NameSetupScreen({ onComplete, onClose }) {
  const { completeOnboardingStep } = useAuth();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await completeOnboardingStep('name', { displayName: name.trim() });
      
      if (result.success && onComplete) {
        onComplete();
      } else if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to save your name. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>
              Help your friends find you on Voilà
            </Text>
          </View>

          {/* Name Input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, (!name.trim() || isLoading) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? (
              <LoadingIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Address Setup Screen
export function AddressSetupScreen({ onComplete, onClose }) {
  const { completeOnboardingStep, createAddress } = useAuth();
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
  };

  const handleContinue = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select your address to continue.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create the address
      const addressResult = await createAddress({
        name: 'Home',
        formatted: selectedAddress.address,
        coordinates: {
          lat: selectedAddress.location.lat,
          lng: selectedAddress.location.lng
        },
        placeId: selectedAddress.placeId,
        tag: 'home',
        isDefault: true
      });

      if (addressResult.success) {
        // Mark address step as complete
        const result = await completeOnboardingStep('address', {});
        
        if (result.success && onComplete) {
          onComplete();
        } else if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to save your address. Please try again.');
        }
      } else {
        Alert.alert('Error', addressResult.error || 'Failed to save your address. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.title}>Where do you live?</Text>
          <Text style={styles.subtitle}>
            Add your home address to find perfect meeting spots
          </Text>
        </View>

        {/* Address Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Home Address</Text>
          <AddressInput
            onPlaceSelected={handleAddressSelect}
            placeholder="Enter your address"
            style={styles.addressInput}
          />
        </View>

        {/* Selected Address Display */}
        {selectedAddress && (
          <View style={styles.selectedAddressContainer}>
            <MaterialIcons name="location-on" size={20} color="#6366f1" />
            <Text style={styles.selectedAddressText}>
              {selectedAddress.address}
            </Text>
          </View>
        )}

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, (!selectedAddress || isLoading) && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedAddress || isLoading}
        >
          {isLoading ? (
            <LoadingIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Contacts Permission Screen
export function ContactsSetupScreen({ onComplete, onClose }) {
  const { completeOnboardingStep } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleAllowContacts = async () => {
    setIsLoading(true);
    
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Mark contacts step as complete
        const result = await completeOnboardingStep('contacts', {});
        
        if (result.success && onComplete) {
          onComplete();
        } else if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to complete setup. Please try again.');
        }
      } else {
        Alert.alert(
          'Permission Required',
          'Contact access is required to complete your account setup. Please allow access to continue.',
          [
            {
              text: 'Try Again',
              onPress: () => handleAllowContacts()
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📞</Text>
          <Text style={styles.title}>Find your friends</Text>
          <Text style={styles.subtitle}>
            Contact access is required to find friends and complete your account setup
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefit}>
            <MaterialIcons name="group" size={24} color="#6366f1" />
            <Text style={styles.benefitText}>Find friends automatically</Text>
          </View>
          <View style={styles.benefit}>
            <MaterialIcons name="security" size={24} color="#6366f1" />
            <Text style={styles.benefitText}>Your contacts stay private</Text>
          </View>
          <View style={styles.benefit}>
            <MaterialIcons name="sync" size={24} color="#6366f1" />
            <Text style={styles.benefitText}>Stay connected with new users</Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
          onPress={handleAllowContacts}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.continueButtonText}>Allow Contact Access</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#ffffff',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
  },
  selectedAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8faff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  selectedAddressText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  benefitsContainer: {
    marginBottom: 32,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 