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
  Alert,
  PanResponder,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { googleMapsService } from '@/services/map/GoogleMapsService';
import { preloadIsochroneForAddress } from '@/services/preloadApi';
import { useGroups } from '@/contexts/GroupsContext';
import { useAuth } from '@/contexts/AuthContext';
import { contactService } from '@/services/contactService';
import { isInIleDeFrance } from '@/utils';
import { inviteContact } from '@/services/shareService';

const { height: screenHeight } = Dimensions.get('window');

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
  const [showModal, setShowModal] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  const debounceTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const translateY = useRef(new Animated.Value(0)).current;
  const dragThreshold = 80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > dragThreshold) {
          Animated.timing(translateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            handleModalClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const groupsContext = useGroups();
  const authContext = useAuth();
  const findUsersByPhoneNumbers = groupsContext?.findUsersByPhoneNumbers;
  const getUserAddresses = groupsContext?.getUserAddresses;
  const user = authContext?.user;
  const contextAvailable = !!(findUsersByPhoneNumbers && getUserAddresses && user);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (contextAvailable) loadContacts();
  }, [contextAvailable]);

  const loadContacts = async () => {
    try {
      if (!isMountedRef.current || !contactService) return;
      const permissionStatus = await contactService.getPermissionStatus();
      if (!isMountedRef.current) return;
      if (permissionStatus !== 'granted') {
        const granted = await contactService.showPermissionDialog();
        if (!granted || !isMountedRef.current) return;
      }
      await contactService.loadContacts();
      if (isMountedRef.current) setContactsLoaded(true);
    } catch {
      if (isMountedRef.current) setContactsLoaded(false);
    }
  };

  const searchFriends = useCallback(async (input) => {
    if (!input || input.trim().length < 2 || !contextAvailable || !contactsLoaded || !contactService?.contacts?.length) return [];
    try {
      const term = input.toLowerCase().trim();
      const filteredContacts = contactService.contacts.filter(contact =>
        contact.name.toLowerCase().includes(term) ||
        contact.firstName.toLowerCase().includes(term) ||
        contact.lastName.toLowerCase().includes(term)
      );
      if (!filteredContacts.length) return [];

      const phoneNumbers = filteredContacts
        .flatMap(contact => contact.phoneNumbers.map(phone => phone.normalized))
        .filter(Boolean);

      // Find registered users among these contacts
      const registeredData = await findUsersByPhoneNumbers(phoneNumbers).catch(() => []);

      const registeredPhoneMap = new Map();
      registeredData.forEach(user => {
        const dbPhone = user.phone_number;
        registeredPhoneMap.set(dbPhone, user);
        if (dbPhone.startsWith('+')) registeredPhoneMap.set(dbPhone.substring(1), user);
        else registeredPhoneMap.set('+' + dbPhone, user);
      });

      const registeredContacts = [];
      const unregisteredContacts = [];

      filteredContacts.forEach(contact => {
        let matchedUserData = null;
        for (const phoneObj of contact.phoneNumbers) {
          const contactNormalized = phoneObj.normalized;
          if (registeredPhoneMap.has(contactNormalized)) {
            matchedUserData = registeredPhoneMap.get(contactNormalized);
            break;
          }
          if (contactNormalized.startsWith('+')) {
            const withoutPlus = contactNormalized.substring(1);
            if (registeredPhoneMap.has(withoutPlus)) {
              matchedUserData = registeredPhoneMap.get(withoutPlus);
              break;
            }
          }
          if (!contactNormalized.startsWith('+')) {
            const withPlus = '+' + contactNormalized;
            if (registeredPhoneMap.has(withPlus)) {
              matchedUserData = registeredPhoneMap.get(withPlus);
              break;
            }
          }
        }
        if (matchedUserData) {
          registeredContacts.push({ contact, userData: matchedUserData });
        } else {
          unregisteredContacts.push(contact);
        }
      });

      // Fetch addresses for registered users (if any)
      let addressesMap = {};
      if (registeredContacts.length && getUserAddresses) {
        const userIds = registeredContacts.map(({ userData }) => userData.id);
        addressesMap = await getUserAddresses(userIds).catch(() => ({}));
      }

      // Format results: registered first, then unregistered
      const formattedRegistered = registeredContacts.map(({ contact, userData }) => {
        const userAddress = addressesMap[userData.id];
        return {
          id: userData.id,
          display_name: contact.name,
          address: userAddress?.formatted_address || userAddress?.name || `${userAddress?.latitude}, ${userAddress?.longitude}`,
          location: userAddress ? { lat: userAddress.latitude, lng: userAddress.longitude } : null,
          placeId: userAddress?.place_id || null,
          type: 'friend',
          isRegistered: true,
        };
      }).filter(item => item.address && item.location);

      const formattedUnregistered = unregisteredContacts.map(contact => ({
        id: contact.id,
        display_name: contact.name,
        address: 'Invite to Voilà',
        type: 'contact',
        isRegistered: false,
      }));

      return [...formattedRegistered, ...formattedUnregistered].slice(0, 10);
    } catch {
      return [];
    }
  }, [findUsersByPhoneNumbers, getUserAddresses, contextAvailable, contactsLoaded]);

  const fetchPredictions = useCallback(async (input) => {
    if (!input || input.trim().length < 2) {
      if (isMountedRef.current) {
        setPredictions([]);
        setFriends([]);
        setShowPredictions(false);
      }
      return;
    }
    if (isMountedRef.current) setIsLoading(true);
    
    try {
      const [friendResults, placeResults] = await Promise.all([
        searchFriends(input).catch(() => []),
        googleMapsService.getPlacePredictions(input, bounds).catch(() => [])
      ]);

      if (!isMountedRef.current) return;

      const formattedPlaces = placeResults.map(place => ({ ...place, type: 'place' }));
      
      setFriends(friendResults);
      setPredictions(formattedPlaces);
      setShowPredictions(friendResults.length > 0 || formattedPlaces.length > 0);
    } catch (error) {
      if (isMountedRef.current) {
        onError && onError({ error: error.message });
        setFriends([]);
        setPredictions([]);
        setShowPredictions(false);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [bounds, onError, searchFriends]);

  const debouncedFetchPredictions = useCallback((input) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) fetchPredictions(input);
    }, 300);
  }, [fetchPredictions]);

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

  const handlePlaceSelection = async (selection) => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setShowPredictions(false);

    try {
      let selectedPlace;
      if (selection.type === 'friend') {
        if (!isInIleDeFrance(selection.location)) {
          Alert.alert(
            'Location Not Supported',
            "This friend's location is outside the Île-de-France region. Currently, we only support locations within Île-de-France."
          );
          setIsLoading(false);
          return;
        }
        selectedPlace = {
          address: selection.address,
          location: selection.location,
          placeId: selection.placeId,
          friendName: selection.display_name,
          friendId: selection.id,
          type: 'friend'
        };
        setInputValue(selection.display_name);
      } else {
        const placeDetails = await googleMapsService.getPlaceDetails(selection.place_id);
        if (!isMountedRef.current) return;
        if (!isInIleDeFrance(placeDetails.location)) {
          Alert.alert(
            'Location Not Supported',
            'Please select a location within the Île-de-France region. Currently, we only support locations within Île-de-France.'
          );
          setIsLoading(false);
          return;
        }
        selectedPlace = {
          address: placeDetails.address,
          location: placeDetails.location,
          placeId: placeDetails.placeId
        };
        setInputValue(placeDetails.address);
      }
      onPlaceSelected && onPlaceSelected(selectedPlace);
      if (isMountedRef.current) {
        setShowModal(false);
      }
      if (enablePreload && selectedPlace.location) {
        preloadIsochroneForAddress(selectedPlace.location).catch(error => {
          console.warn('Preload failed (non-critical):', error);
        });
      }
    } catch (error) {
      if (isMountedRef.current) onError && onError({ error: error.message });
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  const handleInvite = async (contactItem) => {
    try {
      const firstName = (contactItem?.display_name || '').split(' ')[0] || '';
      await inviteContact(firstName);
    } catch (e) {
      console.error('Invite failed:', e);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setFriends([]);
    setPredictions([]);
    setShowPredictions(false);
    onInput && onInput({ value: '' });
  };

  const handleFocus = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setShowPredictions(false);
    setFriends([]);
    setPredictions([]);
  };

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const renderFriend = (item, index) => (
    <TouchableOpacity
      key={`friend-${item.id}`}
      style={[
        styles.predictionItem,
        styles.friendItem,
        index === friends.length - 1 && predictions.length === 0 && styles.predictionItemLast
      ]}
      onPress={() => item.isRegistered ? handlePlaceSelection(item) : handleInvite(item)}
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
          {item.isRegistered ? item.address : 'Invite to Voilà'}
        </Text>
      </View>
      {!item.isRegistered && (
        <View style={styles.inviteButton}>
          <Text style={styles.inviteButtonText}>Invite</Text>
        </View>
      )}
    </TouchableOpacity>
  );

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
        transparent={true}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalContainerOverlayed}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleModalClose}
          />
          <Animated.View
            style={[
              styles.bottomSheetContainer,
              { transform: [{ translateY }] }
            ]}
          >
            <KeyboardAvoidingView 
              style={styles.bottomSheetContent} 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
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
              <ScrollView 
                style={styles.predictionsContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {showPredictions && (friends.length > 0 || predictions.length > 0) ? (
                  <View style={styles.predictionsList}>
                    {friends.length > 0 && (
                      <>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>Contacts</Text>
                        </View>
                        {friends.map((item, index) => renderFriend(item, index))}
                      </>
                    )}
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
                        No addresses or contacts found. Try a different search.
                      </Text>
                    </View>
                  )
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  bottomSheetContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.85,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bottomSheetContent: {
    flex: 1,
  },
  modalHeaderWithClose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'relative',
  },
  modalHeaderHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    width: 40,
    height: 4,
    marginLeft: -20,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  closeIcon: {
    fontSize: 22,
    color: '#64748b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
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
  noPredictions: {
    padding: 20,
    alignItems: 'center',
  },
  noPredictionsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalContainerOverlayed: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  inviteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  inviteButtonText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
  },
};

export default AddressInput; 