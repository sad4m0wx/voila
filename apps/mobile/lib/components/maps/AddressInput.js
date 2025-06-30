import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { googleMapsService } from '../../services/map/GoogleMapsService';
import { preloadIsochroneForAddress } from '../../services/preloadApi';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AddressInput = ({
  value = '',
  placeholder = 'Enter an address',
  disabled = false,
  bounds = null,
  enablePreload = true,
  onInput,
  onPlaceSelected,
  onError
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Debounce function for API calls
  const debounce = useCallback((func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Get place predictions from Google Places API
  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.trim().length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await googleMapsService.getPlacePredictions(input, bounds);
      setPredictions(results);
      setShowPredictions(results.length > 0);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      onError && onError({ error: error.message });
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsLoading(false);
    }
  }, [bounds, onError]);

  // Debounced version of fetchPredictions
  const debouncedFetchPredictions = useCallback(
    debounce(fetchPredictions, 300),
    [fetchPredictions]
  );

  // Handle input changes
  const handleInputChange = (text) => {
    setInputValue(text);
    onInput && onInput({ value: text });
    
    if (text.trim()) {
      debouncedFetchPredictions(text);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  // Handle place selection
  const handlePlaceSelection = async (prediction) => {
    setIsLoading(true);
    setShowPredictions(false);
    
    try {
      const placeDetails = await googleMapsService.getPlaceDetails(prediction.place_id);
      
      const selectedPlace = {
        address: placeDetails.address,
        location: placeDetails.location,
        placeId: placeDetails.placeId
      };

      setInputValue(placeDetails.address);
      onPlaceSelected && onPlaceSelected(selectedPlace);

      // Close modal and reset state
      setShowModal(false);
      setIsFocused(false);

      // Trigger preload if enabled
      if (enablePreload) {
        preloadIsochroneForAddress(placeDetails.location).catch(error => {
          console.warn('Preload failed (non-critical):', error);
        });
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      onError && onError({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    setPredictions([]);
    setShowPredictions(false);
    onInput && onInput({ value: '' });
  };

  // Handle focus - open modal
  const handleFocus = () => {
    setIsFocused(true);
    setShowModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setIsFocused(false);
    setShowPredictions(false);
    setPredictions([]);
  };

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Render prediction item
  const renderPrediction = (item, index) => (
    <TouchableOpacity
      key={item.place_id}
      style={[
        styles.predictionItem,
        index === predictions.length - 1 && styles.predictionItemLast
      ]}
      onPress={() => handlePlaceSelection(item)}
    >
      <View style={styles.predictionIcon}>
        <Text style={styles.locationIcon}>📍</Text>
      </View>
      <View style={styles.predictionText}>
        <Text style={styles.primaryText}>
          {item.structured_formatting?.main_text || item.description}
        </Text>
        <Text style={styles.secondaryText}>
          {item.structured_formatting?.secondary_text || ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Main Input Field */}
      <TouchableOpacity 
        style={styles.container} 
        onPress={handleFocus}
        disabled={disabled}
      >
        <View style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          disabled && styles.inputDisabled
        ]}>
          {/* Location Icon */}
          <View style={styles.leftIcon}>
            <Text style={styles.locationIcon}>📍</Text>
          </View>
          
          {/* Display Text (not editable here) */}
          <Text 
            style={[
              styles.inputText,
              !inputValue && styles.placeholderText
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {inputValue || placeholder}
          </Text>
          
          {/* Clear Button */}
          {inputValue && !disabled && (
            <TouchableOpacity
              style={styles.rightIcon}
              onPress={handleClear}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Full Screen Search Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleModalClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.modalContent} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleModalClose}
              >
                <Text style={styles.backIcon}>←</Text>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Enter Address</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <View style={styles.leftIcon}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#6b7280" />
                  ) : (
                    <Text style={styles.locationIcon}>📍</Text>
                  )}
                </View>
                
                <TextInput
                  style={styles.searchInput}
                  value={inputValue}
                  placeholder={placeholder}
                  placeholderTextColor="#9ca3af"
                  onChangeText={handleInputChange}
                  autoFocus={true}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                
                {inputValue && (
                  <TouchableOpacity
                    style={styles.rightIcon}
                    onPress={handleClear}
                  >
                    <Text style={styles.clearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Predictions List */}
            <ScrollView 
              style={styles.predictionsContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {showPredictions && predictions.length > 0 ? (
                <View style={styles.predictionsList}>
                  {predictions.map((item, index) => renderPrediction(item, index))}
                </View>
              ) : (
                inputValue.length >= 2 && !isLoading && (
                  <View style={styles.noPredictions}>
                    <Text style={styles.noPredictionsText}>
                      No addresses found. Try a different search.
                    </Text>
                  </View>
                )
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = {
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputFocused: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    opacity: 0.6,
  },
  leftIcon: {
    marginRight: 8,
    width: 20,
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    color: '#6b7280',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    padding: 0,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  rightIcon: {
    marginLeft: 8,
    padding: 4,
  },
  clearIcon: {
    fontSize: 14,
    color: '#6b7280',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backIcon: {
    fontSize: 18,
    color: '#3b82f6',
    marginRight: 4,
  },
  backText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    flex: 2,
  },
  headerSpacer: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    padding: 0,
  },
  predictionsContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  predictionsList: {
    paddingVertical: 8,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  predictionItemLast: {
    borderBottomWidth: 0,
  },
  predictionIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  predictionText: {
    flex: 1,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  secondaryText: {
    fontSize: 14,
    color: '#6b7280',
  },
  noPredictions: {
    padding: 20,
    alignItems: 'center',
  },
  noPredictionsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
};

export default AddressInput; 