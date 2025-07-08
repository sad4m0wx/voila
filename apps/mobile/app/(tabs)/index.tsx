import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  findOptimalMeetingPoint,
  defaultMapCenter, 
  defaultMapZoom,
  AddressForm,
  MeetingPointResults,
  MapContainer,
  MetroBackground,
  LoadingIndicator,
  SignInButton,
  ProfileButton,
  useAuth
} from '../../lib';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Auth Button Component
function AuthButton() {
  const { user, isFullyOnboarded } = useAuth();
  
  if (user && isFullyOnboarded) {
    return <ProfileButton />;
  } else {
    return <SignInButton />;
  }
}

export default function HomeScreen() {
  const { share } = useLocalSearchParams();
  
  // State
  const [addresses, setAddresses] = useState([
    { id: 1, value: '', coordinates: null }, 
    { id: 2, value: '', coordinates: null }
  ]);
  const [meetingPoint, setMeetingPoint] = useState(null);
  const [meetingPoints, setMeetingPoints] = useState([]);
  const [currentMeetingPointIndex, setCurrentMeetingPointIndex] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [venues, setVenues] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [animateToResults, setAnimateToResults] = useState(false);

  // Animated values for smooth map height transitions
  const mapHeightAnim = useRef(new Animated.Value(320)).current;

  // Venue options
  const [showVenues, setShowVenues] = useState(true);
  const [venueTypes, setVenueTypes] = useState(['restaurant']);
  const [venueRadius, setVenueRadius] = useState(500);

  // Calculate base map height based on state
  const getBaseMapHeight = () => {
    if (mapExpanded) return 380;
    if (showResults) return 300;
    return 280;
  };

  // Animate map height changes
  const animateMapHeight = (targetHeight) => {
    Animated.timing(mapHeightAnim, {
      toValue: targetHeight,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Update map height when state changes
  useEffect(() => {
    const targetHeight = getBaseMapHeight();
    animateMapHeight(targetHeight);
  }, [mapExpanded, showResults]);

  // Check for shared meeting point parameter
  useEffect(() => {
    if (share) {
      loadSharedMeetingPoint(share);
    }
  }, [share]);

  const loadSharedMeetingPoint = async (shareId) => {
    try {
      setIsCalculating(true);
      setError(null);
      setShowResults(false);
      
      // Import the share service
      const { getSharedMeetingPoint } = await import('../../lib/services/shareService');
      const result = await getSharedMeetingPoint(shareId);
      
      if (result.success && result.meetingPointResult) {
        const data = result.meetingPointResult;
        
        // Extract meeting point (use first one if multiple)
        if (data.meeting_points && data.meeting_points.length > 0) {
          const mp = data.meeting_points[0];
          const meetingPointData = {
            name: mp.name,
            coordinates: mp.coordinates,
            travelTimes: mp.travel_times || []
          };
          
          setMeetingPoint(meetingPointData);
          setMeetingPoints([meetingPointData]);
          setCurrentMeetingPointIndex(0);
        }
        
        // Extract venues and routes
        setVenues(data.venues || []);
        const routesData = (data.routes && data.routes.length > 0) ? data.routes[0] : [];
        setRoutes(routesData);
        setAllRoutes([routesData]);
        
        // Create addresses from travel times for display
        if (data.meeting_points?.[0]?.travel_times) {
          const addressList = data.meeting_points[0].travel_times.map((tt, index) => ({
            id: tt.id || index + 1,
            value: tt.address,
            coordinates: null // We don't need coordinates for display
          }));
          setAddresses(addressList);
        }
        
        // Show results and trigger animation
        setShowResults(true);
        setTimeout(() => {
          setAnimateToResults(true);
        }, 500);
        
      } else {
        setError(result.error || 'Failed to load shared meeting point');
      }
    } catch (err) {
      console.error('Error loading shared meeting point:', err);
      setError('Failed to load shared meeting point');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleFindMeetingPoint = async () => {
    try {
      // Process addresses to include both regular addresses and friend addresses
      const processedAddresses = addresses.map(addr => {
        // For friend addresses, extract coordinates from friendData
        if (addr.friendData && addr.friendData.location) {
          return {
            ...addr,
            coordinates: [addr.friendData.location.lng, addr.friendData.location.lat],
            value: addr.friendData.address || addr.value
          };
        }
        // For regular addresses, use as-is
        return addr;
      });

      // Check if we have at least 2 addresses with coordinates (including friends)
      const validAddresses = processedAddresses.filter(addr => 
        addr.value && addr.value.trim() !== '' && addr.coordinates
      );

      if (validAddresses.length < 2) {
        Alert.alert(
          'Not enough addresses',
          'Please enter at least 2 valid addresses or select friends with addresses to calculate a meeting point.'
        );
        return;
      }

      setIsCalculating(true);
      setError(null);
      setAnimateToResults(false);

      const result = await findOptimalMeetingPoint(validAddresses, {
        venueTypes,
        venueRadius,
        showVenues
      });

      if (result) {
        // Handle allRoutes properly - if it's empty, create it from routes
        let processedAllRoutes = result.allRoutes;
        
        if (!processedAllRoutes || processedAllRoutes.length === 0) {
          processedAllRoutes = [];
          const meetingPointsCount = result.allMeetingPoints?.length || 1;
          
          for (let i = 0; i < meetingPointsCount; i++) {
            if (i === 0) {
              processedAllRoutes.push(result.routes || []);
            } else {
              processedAllRoutes.push([]);
            }
          }
        }

        // Store all meeting points and routes
        setMeetingPoints(result.allMeetingPoints || [result]);
        setAllRoutes(processedAllRoutes);
        
        // Set the first meeting point as current
        setMeetingPoint(result);
        setRoutes(result.routes || []);
        setVenues(result.venues || []);
        setCurrentMeetingPointIndex(0);
        
        setShowResults(true);
        
        // Trigger animation to results after a short delay
        setTimeout(() => {
          setAnimateToResults(true);
        }, 500);
      }
    } catch (err) {
      console.error('Meeting point calculation error:', err);
      setError(err.message || "Failed to calculate meeting point. Please try again.");
    } finally {
      setIsCalculating(false);
    }
  };

  const updateCurrentMeetingPoint = (index, meetingPointsData = meetingPoints) => {
    if (meetingPointsData.length > 0 && index < meetingPointsData.length) {
      const currentPoint = meetingPointsData[index];
      const newRoutes = allRoutes[index] || [];
      
      setMeetingPoint({
        name: currentPoint.name,
        coordinates: currentPoint.coordinates,
        travelTimes: currentPoint.travel_times || currentPoint.travelTimes
      });
      setRoutes(newRoutes);
      setCurrentMeetingPointIndex(index);
      
      // Trigger animation to new meeting point
      setAnimateToResults(true);
      setTimeout(() => setAnimateToResults(false), 1000);
    }
  };

  const handleMeetingPointChange = (index) => {
    updateCurrentMeetingPoint(index);
  };

  const handleMapBounds = (boundsData) => {
    setMapBounds(boundsData.bounds);
  };

  const toggleMapExpanded = () => {
    setMapExpanded(!mapExpanded);
  };

  // Create map markers for all locations
  const createMapMarkers = () => {
    const markers = [];

    // Add markers for addresses (including friends)
    addresses.forEach((address, index) => {
      let coordinates = null;
      let title = null;
      
      // Handle friend addresses
      if (address.friendData && address.friendData.location) {
        coordinates = [address.friendData.location.lng, address.friendData.location.lat];
        title = `${address.friendData.name} (${address.friendData.address})`;
      }
      // Handle regular addresses
      else if (address.coordinates) {
        coordinates = address.coordinates;
        title = address.value || `Location ${index + 1}`;
      }

      if (coordinates) {
        markers.push({
          position: coordinates,
          title: title,
          type: 'location',
          number: index + 1
        });
      }
    });

    // Add marker for meeting point
    if (meetingPoint && meetingPoint.coordinates) {
      markers.push({
        position: meetingPoint.coordinates,
        title: meetingPoint.name || 'Meeting Point',
        type: 'meeting-point',
        info: `Meeting Point: ${meetingPoint.name || 'Unknown'}`
      });
    }

    // Add markers for venues
    if (venues && venues.length > 0) {
      venues.forEach((venue, i) => {
        if (venue && venue.location) {
          markers.push({
            position: venue.location,
            title: venue.name || `Venue ${i + 1}`,
            type: 'venue',
            info: `${venue.name || `Venue ${i + 1}`}\n${venue.address || ''}`
          });
        }
      });
    }

    return markers;
  };

  const mapMarkers = createMapMarkers();

  // Start new search
  const handleStartNewSearch = () => {
    setMeetingPoint(null);
    setMeetingPoints([]);
    setAllRoutes([]);
    setCurrentMeetingPointIndex(0);
    setRoutes([]);
    setVenues([]);
    setError(null);
    setIsCalculating(false);
    setShowResults(false);
    setAnimateToResults(false);
    setMapExpanded(false);
    animateMapHeight(320);
  };

  // Handle save location
  const handleSaveLocation = () => {
    Alert.alert(
      'Save Location',
      'Location saving feature will be implemented in the next phase.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.backgroundContainer}>
        <MetroBackground />
      </View>

      <View style={styles.mainContent}>
        {/* MAP AT TOP - Full Screen */}
        <Animated.View 
          style={[
            styles.mapArea,
            { height: mapHeightAnim }
          ]}
        >
            {/* Map Header with Controls */}
            <View style={styles.headerControls}>
              {/* Floating Logo */}
              <View style={styles.logoContainer}>
                <Text style={styles.logoIcon}>📍</Text>
                <Text style={styles.logoText}>Voilà!</Text>
              </View>
              
              {/* Map Controls */}
              <View style={styles.mapControls}>
                {meetingPoint && (
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={toggleMapExpanded}
                  >
                    <MaterialIcons 
                      name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                      size={20} 
                      color="#6b7280" 
                    />
                  </TouchableOpacity>
                )}
                
                {/* Auth Button - SignIn or Profile */}
                <AuthButton />
              </View>
            </View>

            {/* Map Container */}
            <View style={styles.mapContainer}>
              <MapContainer
                center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
                markers={mapMarkers}
                routes={routes}
                meetingPoint={meetingPoint}
                venueRadius={venueRadius}
                animateToResults={animateToResults}
                height="100%"
                onBoundsChange={handleMapBounds}
              />
            </View>
        </Animated.View>

        {/* CONTENT BELOW MAP */}
        <SafeAreaView style={styles.contentSafeArea} edges={['left', 'right', 'bottom']}>
          <ScrollView 
            style={styles.contentScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Loading Indicator */}
            {isCalculating && (
              <View style={styles.loadingContainer}>
                <LoadingIndicator message="Calculating optimal meeting point..." />
              </View>
            )}

            {/* Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error" size={24} color="#ef4444" style={styles.errorIcon} />
                <View style={styles.errorContent}>
                  <Text style={styles.errorTitle}>Calculation Error</Text>
                  <Text style={styles.errorMessage}>{error}</Text>
                  <TouchableOpacity style={styles.errorButton} onPress={handleFindMeetingPoint}>
                    <Text style={styles.errorButtonText}>TRY AGAIN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Address Form or Results */}
            {showResults && meetingPoint && !isCalculating ? (
              <View style={styles.resultsContainer}>
                <MeetingPointResults
                  meetingPoint={meetingPoint}
                  meetingPoints={meetingPoints}
                  currentMeetingPointIndex={currentMeetingPointIndex}
                  setCurrentMeetingPointIndex={handleMeetingPointChange}
                  onStartNewSearch={handleStartNewSearch}
                  onCreateGroup={handleSaveLocation}
                  mode="main"
                  addresses={addresses}
                />
              </View>
            ) : (
              <AddressForm
                addresses={addresses}
                onAddressesChange={setAddresses}
                onFindMeetingPoint={handleFindMeetingPoint}
                isCalculating={isCalculating}
                mapBounds={mapBounds}
                error={error}
              />
            )}

            {/* Bottom spacing for tab bar */}
            <View style={styles.bottomSpacing} />
            </ScrollView>
          </SafeAreaView>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  mainContent: {
    flex: 1,
    zIndex: 1,
    position: 'relative',
  },
  contentSafeArea: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Changed from gray to semi-transparent white to show metro background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mapArea: {
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logoIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8b5cf6', // More vivid purple instead of gray
  },
  mapControls: {
    flexDirection: 'row',
    gap: 8,
  },
  mapControlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  contentScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginVertical: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#8b5cf6', // More vivid purple shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)', // More vivid purple border
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#ef4444', // More vivid red
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)', // More vivid red border
  },
  errorIcon: {
    marginRight: 12,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444', // More vivid red
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#dc2626', // More vivid red but darker for text
    marginBottom: 12,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignSelf: 'flex-start',
  },
  errorButtonText: {
    color: '#ef4444', // More vivid red
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 32,
  },
  resultsContainer: {
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
});