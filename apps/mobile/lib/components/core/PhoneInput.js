import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet
} from 'react-native';
import { validatePhoneNumber, formatPhoneNumber, getCountryCodes } from '../../utils/phoneUtils';

const PhoneInput = ({
  value = '',
  placeholder = 'Enter phone number',
  disabled = false,
  required = false,
  label = 'Phone Number',
  showLabel = true,
  showValidation = true,
  selectedCountryCode = '+33',
  size = 'md',
  onCountryChange,
  onChangeText,
  onInput
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentCountryCode, setCurrentCountryCode] = useState(selectedCountryCode);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [isExternalUpdate, setIsExternalUpdate] = useState(false);

  // Get country codes
  const countryCodes = getCountryCodes();

  // Computed values
  const fullPhoneNumber = currentCountryCode + phoneNumber.replace(/[^\d]/g, '');
  const isPhoneValid = validatePhoneNumber(fullPhoneNumber);

  // Handle country code selection
  const selectCountryCode = (code) => {
    setCurrentCountryCode(code);
    setShowCountryDropdown(false);
    const newFullNumber = code + phoneNumber.replace(/[^\d]/g, '');
    
    if (onCountryChange) {
      onCountryChange({ countryCode: code });
    }
    if (onChangeText) {
      onChangeText(newFullNumber);
    }
  };

  // Handle phone number input
  const handlePhoneInput = (inputValue) => {
    
    // Allow only digits
    const cleanedValue = inputValue.replace(/[^\d]/g, '');
    setPhoneNumber(cleanedValue);
    const newFullNumber = currentCountryCode + cleanedValue;
    
    
    // Call callbacks
    if (onInput) {
      onInput({ value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
    }
    if (onChangeText) {
      onChangeText(newFullNumber);
    }
  };

  // Initialize from external value
  const initializeFromValue = (val) => {
    if (!val || val === currentCountryCode) {
      setPhoneNumber('');
      return;
    }
    
    // Parse external value to extract country code and phone number
    const codes = countryCodes.map(c => c.code).sort((a, b) => b.length - a.length);
    const matchingCode = codes.find(code => val.startsWith(code));
    if (matchingCode) {
      setCurrentCountryCode(matchingCode);
      setPhoneNumber(val.slice(matchingCode.length));
    } else if (val.startsWith('+')) {
      // If it starts with + but no matching code found, just set as phone number
      setPhoneNumber(val.replace(/[^\d]/g, ''));
    } else {
      // Raw phone number without country code
      setPhoneNumber(val.replace(/[^\d]/g, ''));
    }
  };

  // Initialize component only once
  useEffect(() => {
    if (value && !isExternalUpdate) {
      setIsExternalUpdate(true);
      initializeFromValue(value);
    }
  }, [value, isExternalUpdate]);

  // Reset external update flag when user starts typing
  useEffect(() => {
    if (phoneNumber && isExternalUpdate) {
      setIsExternalUpdate(false);
    }
  }, [phoneNumber, isExternalUpdate]);

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View 
        style={styles.inputContainer}
        onStartShouldSetResponder={() => {
          return false;
        }}
      >
        {/* Country Code Dropdown Button */}
        <TouchableOpacity
          style={[styles.countryButton, disabled && styles.disabled]}
          onPress={() => !disabled && setShowCountryDropdown(true)}
          disabled={disabled}
        >
          <Text style={styles.countryCodeText}>{currentCountryCode}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        
        {/* Phone Number Input */}
        <TextInput
          style={[styles.phoneInput, disabled && styles.disabled]}
          value={phoneNumber}
          onChangeText={handlePhoneInput}
          placeholder={placeholder}
          editable={!disabled}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="telephoneNumber"
          returnKeyType="done"
          pointerEvents="auto"
        />
      </View>
      
      {/* Validation Display */}
      {showValidation && fullPhoneNumber && isPhoneValid && (
        <Text style={styles.validationText}>
          {formatPhoneNumber(fullPhoneNumber)}
        </Text>
      )}

      {/* Country Code Selection Modal */}
      <Modal
        visible={showCountryDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryDropdown(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowCountryDropdown(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
            </View>
            
            <ScrollView style={styles.countryList}>
              {countryCodes.map((country) => (
                <TouchableOpacity
                  key={country.id}
                  style={styles.countryItem}
                  onPress={() => selectCountryCode(country.code)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={styles.countryCode}>{country.code}</Text>
                  <Text style={styles.countryName}>{country.country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCountryDropdown(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 80,
  },
  countryCodeText: {
    fontWeight: '600',
    color: '#374151',
    marginRight: 4,
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#6b7280',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#374151',
    minHeight: 44, // Ensure minimum touch target
    zIndex: 1, // Ensure it's above other elements
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  validationText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    width: 320,
    maxHeight: 400,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#374151',
  },
  countryList: {
    maxHeight: 280,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  countryFlag: {
    fontSize: 18,
    marginRight: 12,
  },
  countryCode: {
    fontWeight: '600',
    fontSize: 16,
    color: '#374151',
    marginRight: 12,
    minWidth: 60,
  },
  countryName: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  modalCancelButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalCancelText: {
    textAlign: 'center',
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PhoneInput; 