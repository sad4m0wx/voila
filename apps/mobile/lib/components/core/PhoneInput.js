import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable
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
  selectedCountryCode = '+1',
  size = 'md',
  onCountryChange,
  onChange,
  onInput
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentCountryCode, setCurrentCountryCode] = useState(selectedCountryCode);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Get country codes
  const countryCodes = getCountryCodes();

  // Computed values
  const fullPhoneNumber = currentCountryCode + phoneNumber.replace(/[^\d]/g, '');
  const isPhoneValid = validatePhoneNumber(fullPhoneNumber);

  // Size classes using NativeWind
  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm', 
    lg: 'px-4 py-3 text-base'
  };

  // Handle country code selection
  const selectCountryCode = (code) => {
    setCurrentCountryCode(code);
    setShowCountryDropdown(false);
    const newFullNumber = code + phoneNumber.replace(/[^\d]/g, '');
    
    if (onCountryChange) {
      onCountryChange({ countryCode: code });
    }
    if (onChange) {
      onChange({ value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
    }
  };

  // Handle phone number input
  const handlePhoneInput = (inputValue) => {
    const cleanedValue = inputValue.replace(/[^\d]/g, '');
    setPhoneNumber(cleanedValue);
    const newFullNumber = currentCountryCode + cleanedValue;
    
    if (onInput) {
      onInput({ value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
    }
    if (onChange) {
      onChange({ value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
    }
  };

  // Initialize from external value
  const initializeFromValue = (val) => {
    if (!val) return;
    
    // Parse external value to extract country code and phone number
    const codes = countryCodes.map(c => c.code).sort((a, b) => b.length - a.length);
    const matchingCode = codes.find(code => val.startsWith(code));
    if (matchingCode) {
      setCurrentCountryCode(matchingCode);
      setPhoneNumber(val.slice(matchingCode.length));
    }
  };

  // Initialize component
  useEffect(() => {
    if (value) {
      initializeFromValue(value);
    }
    setInitialized(true);
  }, []);

  // Watch for external value changes after initialization
  useEffect(() => {
    if (initialized && value && value !== fullPhoneNumber) {
      initializeFromValue(value);
    }
  }, [value, initialized, fullPhoneNumber]);

  return (
    <View className="phone-input">
      {showLabel && (
        <Text className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <Text className="text-red-500"> *</Text>}
        </Text>
      )}
      
      <View className="flex-row">
        {/* Country Code Dropdown Button */}
        <TouchableOpacity
          className={`flex-row items-center border border-r-0 border-gray-300 rounded-l-md bg-gray-50 ${sizeStyles[size]} ${disabled ? 'opacity-50' : ''}`}
          onPress={() => !disabled && setShowCountryDropdown(true)}
          disabled={disabled}
        >
          <Text className="font-medium">{currentCountryCode}</Text>
          <Text className="ml-1">▼</Text>
        </TouchableOpacity>
        
        {/* Phone Number Input */}
        <TextInput
          className={`flex-1 border border-gray-300 rounded-r-md ${sizeStyles[size]} ${disabled ? 'opacity-50 bg-gray-100' : 'bg-white'}`}
          value={phoneNumber}
          onChangeText={handlePhoneInput}
          placeholder={placeholder}
          editable={!disabled}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </View>
      
      {/* Validation Display */}
      {showValidation && fullPhoneNumber && isPhoneValid && (
        <Text className="text-sm text-gray-600 mt-1">
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
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setShowCountryDropdown(false)}
        >
          <View className="bg-white rounded-lg mx-4 w-80 max-h-96">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">Select Country Code</Text>
            </View>
            
            <ScrollView className="max-h-80">
              {countryCodes.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  className="flex-row items-center px-4 py-3 border-b border-gray-100"
                  onPress={() => selectCountryCode(country.code)}
                >
                  <Text className="mr-3 text-lg">{country.flag}</Text>
                  <Text className="mr-3 font-medium text-base">{country.code}</Text>
                  <Text className="text-gray-500 text-base">{country.country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              className="p-4 border-t border-gray-200"
              onPress={() => setShowCountryDropdown(false)}
            >
              <Text className="text-center text-blue-600 font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default PhoneInput; 