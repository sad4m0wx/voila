import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useGroups } from '../../contexts/GroupsContext';
import { useAuth } from '../../contexts/AuthContext';
import { contactService } from '../../services/contactService';

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
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  
  // Use refs to track debounce timeouts and component mount state
  const debounceTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Get context functions with defensive checks
  const groupsContext = useGroups();
  const authContext = useAuth();
  
  const findUsersByPhoneNumbers = groupsContext?.findUsersByPhoneNumbers;
  const getUserAddresses = groupsContext?.getUserAddresses;
  const user = authContext?.user;
  
  // Defensive check for context functions
  const contextAvailable = !!(findUsersByPhoneNumbers && getUserAddresses && user);
  
  if (!contextAvailable) {
    console.warn('AddressInput: Groups context functions or user not available');
  }

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Load contacts when component mounts (same as AddMemberComponent)
  useEffect(() => {
    if (contextAvailable) {
      loadContacts();
    }
  }, [contextAvailable]);

  const loadContacts = async () => {
    try {
      // Check if component is still mounted
      if (!isMountedRef.current) return;

      // Ensure contactService is available
      if (!contactService) {
        console.warn('AddressInput: Contact service not available');
        return;
      }

      // Check permission status
      const permissionStatus = await contactService.getPermissionStatus();
      
      if (!isMountedRef.current) return;

      if (permissionStatus !== 'granted') {
        const granted = await contactService.showPermissionDialog();
        if (!granted || !isMountedRef.current) {
          console.warn('AddressInput: Contact permission not granted');
          return;
        }
      }

      // Load contacts
      await contactService.loadContacts();
      if (isMountedRef.current) {
        setContactsLoaded(true);
        console.log('AddressInput: Contacts loaded successfully', contactService.contacts?.length || 0);
      }
      
    } catch (error) {
      console.error('AddressInput: Error loading contacts:', error);
      // Don't throw the error, just log it and continue
      if (isMountedRef.current) {
        setContactsLoaded(false);
      }
    }
  };

  // Search friends by name (using the same approach as AddMemberComponent)
  const searchFriends = useCallback(async (input) => {
    if (!input || input.trim().length < 2) {
      return [];
    }

    if (!contextAvailable) {
      console.warn('AddressInput: Context not available, skipping friend search');
      return [];
    }

    if (!contactsLoaded || !contactService?.contacts || contactService.contacts.length === 0) {
      console.warn('AddressInput: Contacts not loaded yet, skipping friend search. Loaded:', contactsLoaded, 'Count:', contactService?.contacts?.length || 0);
      return [];
    }

    try {
      // First, search through device contacts by name (same as AddMemberComponent)
      const term = input.toLowerCase().trim();
      const filteredContacts = contactService.contacts.filter(contact =>
        contact.name.toLowerCase().includes(term) ||
        contact.firstName.toLowerCase().includes(term) ||
        contact.lastName.toLowerCase().includes(term)
      );

      if (filteredContacts.length === 0) {
        return [];
      }

      // Extract phone numbers from filtered contacts
      const phoneNumbers = filteredContacts.flatMap(contact => 
        contact.phoneNumbers.map(phone => phone.normalized)
      ).filter(phone => phone);

      if (phoneNumbers.length === 0) {
        return [];
      }

      // Query database for these specific phone numbers
      const registeredData = await findUsersByPhoneNumbers(phoneNumbers);

      if (registeredData.length === 0) {
        return [];
      }

      // Create map of registered phone numbers to user data
      const registeredPhoneMap = new Map();
      registeredData.forEach(user => {
        const dbPhone = user.phone_number;
        registeredPhoneMap.set(dbPhone, user);
        
        // Also store with/without + variations
        if (dbPhone.startsWith('+')) {
          registeredPhoneMap.set(dbPhone.substring(1), user);
        } else {
          registeredPhoneMap.set('+' + dbPhone, user);
        }
      });

      // Find registered contacts and get their addresses
      const registeredContacts = [];
      
      filteredContacts.forEach(contact => {
        let matchedUserData = null;
        
        // Check each phone number in the contact
        for (const phoneObj of contact.phoneNumbers) {
          const contactNormalized = phoneObj.normalized;
          
          if (registeredPhoneMap.has(contactNormalized)) {
            matchedUserData = registeredPhoneMap.get(contactNormalized);
            break;
          }
          
          // Try without + prefix
          if (contactNormalized.startsWith('+')) {
            const withoutPlus = contactNormalized.substring(1);
            if (registeredPhoneMap.has(withoutPlus)) {
              matchedUserData = registeredPhoneMap.get(withoutPlus);
              break;
            }
          }
          
          // Try with + prefix
          if (!contactNormalized.startsWith('+')) {
            const withPlus = '+' + contactNormalized;
            if (registeredPhoneMap.has(withPlus)) {
              matchedUserData = registeredPhoneMap.get(withPlus);
              break;
            }
          }
        }

        if (matchedUserData) {
          registeredContacts.push({
            ...contact,
            userData: matchedUserData,
            type: 'friend',
            isRegistered: true,
          });
        }
      });

      if (registeredContacts.length === 0) {
        console.log('AddressInput: No registered contacts found');
        return [];
      }

      // Get addresses for the registered users
      const userIds = registeredContacts.map(contact => contact.userData.id);
      
      // Debug: Check if getUserAddresses function exists
      if (!getUserAddresses) {
        console.error('AddressInput: getUserAddresses function not available');
        return [];
      }
      
      const addressesMap = await getUserAddresses(userIds);
      
      // Combine contacts with their addresses
      const friendsWithAddresses = registeredContacts.map(contact => {
        const userAddress = addressesMap[contact.userData.id];
        
        return {
          ...contact,
          address: userAddress ? (
            userAddress.formatted_address || 
            userAddress.name || 
            `${userAddress.latitude}, ${userAddress.longitude}`
          ) : null,
          location: userAddress ? {
            lat: userAddress.latitude,
            lng: userAddress.longitude
          } : null,
          placeId: userAddress?.place_id || null,
          display_name: contact.name, // Use contact name instead of user display_name
          id: contact.userData.id // Use user ID
        };
      });
      
      const filteredFriends = friendsWithAddresses.filter(friend => friend.address);
      
      return filteredFriends;
    } catch (error) {
      console.error('AddressInput: Error searching friends:', error);
      return [];
    }
  }, [findUsersByPhoneNumbers, getUserAddresses, contextAvailable, contactsLoaded]);

  // Get place predictions from Google Places API
  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.trim().length < 2) {
      if (isMountedRef.current) {
        setPredictions([]);
        setFriends([]);
        setShowPredictions(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }
    
    try {
      // Search for both friends and places
      const [friendResults, placeResults] = await Promise.all([
        searchFriends(input).catch(err => {
          console.warn('AddressInput: Friend search failed:', err);
          return [];
        }),
        googleMapsService.getPlacePredictions(input, bounds).catch(err => {
          console.warn('AddressInput: Place search failed:', err);
          return [];
        })
      ]);

      // Only update state if component is still mounted
      if (!isMountedRef.current) return;

      // Format place results
      const formattedPlaces = placeResults.map(place => ({
        ...place,
        type: 'place'
      }));

      setFriends(friendResults);
      setPredictions(formattedPlaces);
      setShowPredictions(friendResults.length > 0 || formattedPlaces.length > 0);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      if (isMountedRef.current) {
        onError && onError({ error: error.message });
        setFriends([]);
        setPredictions([]);
        setShowPredictions(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [bounds, onError, searchFriends]);

  // Debounced version of fetchPredictions
  const debouncedFetchPredictions = useCallback(
    (input) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchPredictions(input);
        }
      }, 300);
    },
    [fetchPredictions]
  );

  // Handle input changes
  const handleInputChange = (text) => {
    setInputValue(text);
    onInput && onInput({ value: text });
    
    if (text.trim()) {
      debouncedFetchPredictions(text);
    } else {
      setFriends([]);
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  // Handle place selection (both friends and places)
  const handlePlaceSelection = async (selection) => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setShowPredictions(false);
    
    try {
      let selectedPlace;
      
      if (selection.type === 'friend') {
        // Handle friend selection
        selectedPlace = {
          address: selection.address,
          location: selection.location,
          placeId: selection.placeId,
          friendName: selection.display_name,
          friendId: selection.id,
          type: 'friend' // Mark as friend selection
        };
        
        // Show friend's name in the input field instead of their address
        if (isMountedRef.current) {
          setInputValue(selection.display_name);
        }
      } else {
        // Handle Google place selection
        const placeDetails = await googleMapsService.getPlaceDetails(selection.place_id);
        
        // Check if component is still mounted after async operation
        if (!isMountedRef.current) return;
        
        selectedPlace = {
          address: placeDetails.address,
          location: placeDetails.location,
          placeId: placeDetails.placeId
        };
        
        setInputValue(placeDetails.address);
      }

      onPlaceSelected && onPlaceSelected(selectedPlace);

      // Close modal and reset state only if still mounted
      if (isMountedRef.current) {
        setShowModal(false);
        setIsFocused(false);
      }

      // Trigger preload if enabled and we have location
      if (enablePreload && selectedPlace.location) {
        preloadIsochroneForAddress(selectedPlace.location).catch(error => {
          console.warn('Preload failed (non-critical):', error);
        });
      }
    } catch (error) {
      console.error('Error handling place selection:', error);
      if (isMountedRef.current) {
        onError && onError({ error: error.message });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    setFriends([]);
    setPredictions([]);
    setShowPredictions(false);
    onInput && onInput({ value: '' });
  };

  // Handle focus - open modal
  const handleFocus = () => {
    setIsFocused(true);
    setShowModal(true);
    
    // Debug: Check if contacts are loaded when modal opens
    console.log('AddressInput: Modal opened. Contacts loaded:', contactsLoaded, 'Count:', contactService.contacts?.length || 0);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setIsFocused(false);
    setShowPredictions(false);
    setFriends([]);
    setPredictions([]);
  };

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Render friend item
  const renderFriend = (item, index) => (
    <TouchableOpacity
      key={`friend-${item.id}`}
      style={[
        styles.predictionItem,
        styles.friendItem,
        index === friends.length - 1 && predictions.length === 0 && styles.predictionItemLast
      ]}
      onPress={() => handlePlaceSelection(item)}
    >
      <View style={styles.predictionIcon}>
        <Text style={styles.friendIcon}>👤</Text>
      </View>
      <View style={styles.predictionText}>
        <Text style={styles.primaryText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.display_name}
        </Text>
        <Text style={styles.secondaryText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.address}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.primaryText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.structured_formatting?.main_text || item.description}
        </Text>
        <Text style={styles.secondaryText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
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

            {/* Results List */}
            <ScrollView 
              style={styles.predictionsContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {showPredictions && (friends.length > 0 || predictions.length > 0) ? (
                <View style={styles.predictionsList}>
                  {/* Friends Section */}
                  {friends.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Friends</Text>
                      </View>
                      {friends.map((item, index) => renderFriend(item, index))}
                    </>
                  )}
                  
                  {/* Places Section */}
                  {predictions.length > 0 && (
                    <>
                      {friends.length > 0 && <View style={styles.sectionDivider} />}
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Places</Text>
                      </View>
                      {predictions.map((item, index) => renderPrediction(item, index))}
                    </>
                  )}
                </View>
              ) : (
                inputValue.length >= 2 && !isLoading && (
                  <View style={styles.noPredictions}>
                    <Text style={styles.noPredictionsText}>
                      No addresses or friends found. Try a different search.
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#f3f4f6',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  friendItem: {
    backgroundColor: '#fefefe',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  predictionItemLast: {
    borderBottomWidth: 0,
  },
  predictionIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  friendIcon: {
    fontSize: 16,
    color: '#3b82f6',
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
  friendLabel: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
    marginTop: 2,
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