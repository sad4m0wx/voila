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
    // Show sign in button for non-authenticated users or users in onboarding
    return <SignInButton />;
  }
}

export default function HomeScreen() {
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
  const scrollOffset = useRef(0).current;

  // Venue options
  const [showVenues, setShowVenues] = useState(true);
  const [venueTypes, setVenueTypes] = useState(['restaurant']);
  const [venueRadius, setVenueRadius] = useState(500);

  // Calculate base map height based on state
  const getBaseMapHeight = () => {
    if (mapExpanded) return 360;
    if (showResults) return 280;
    return 320;
  };

  // Animate map height to target value
  const animateMapHeight = (targetHeight, duration = 300) => {
    Animated.timing(mapHeightAnim, {
      toValue: targetHeight,
      duration: duration,
      useNativeDriver: false,
    }).start();
  };

  // Handle scroll events to adjust map height smoothly
  const handleScroll = (event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const scrollThreshold = 50;
    const maxReduction = 120;
    
    // Don't reduce height if map is manually expanded
    if (mapExpanded) return;
    
    const baseHeight = getBaseMapHeight();
    let targetHeight = baseHeight;
    
    if (scrollY > scrollThreshold) {
      const reduction = Math.min(scrollY - scrollThreshold, maxReduction);
      targetHeight = Math.max(baseHeight - reduction, 160);
    }
    
    // Use direct setValue for smooth scroll-based changes (no animation lag)
    mapHeightAnim.setValue(targetHeight);
  };

  // Handle map expand/collapse with smooth animation
  const toggleMapExpanded = () => {
    setMapExpanded(!mapExpanded);
    const newBaseHeight = !mapExpanded ? 360 : (showResults ? 280 : 320);
    animateMapHeight(newBaseHeight);
  };

  // Update map height when showResults changes
  useEffect(() => {
    if (!mapExpanded) {
      const newHeight = getBaseMapHeight();
      animateMapHeight(newHeight);
    }
  }, [showResults, mapExpanded]);

  // Initialize map height on component mount
  useEffect(() => {
    const initialHeight = getBaseMapHeight();
    mapHeightAnim.setValue(initialHeight);
  }, []);

  // Find meeting point with real API
  const handleFindMeetingPoint = async () => {
    // Reset state
    setError(null);
    setIsCalculating(true);
    setShowResults(false);
    setVenues([]);
    setAnimateToResults(false);
    setMeetingPoints([]);
    setAllRoutes([]);
    setCurrentMeetingPointIndex(0);

    try {
      // Validate inputs - include both regular addresses and friends
      const filledAddresses = addresses.filter(addr => addr.value.trim() && (addr.coordinates || addr.friendData));
      if (filledAddresses.length < 2) {
        throw new Error("Please enter at least 2 addresses");
      }

      // Convert addresses to API format, handling both regular addresses and friends
      const apiAddresses = filledAddresses.map((addr, index) => {
        if (addr.friendData) {
          // Use friend's address coordinates
          return {
            id: `addr-${index}`,
            value: addr.friendData.address,
            coordinates: [addr.friendData.location.lng, addr.friendData.location.lat]
          };
        } else {
          // Regular address
          return {
            id: `addr-${index}`,
            value: addr.value,
            coordinates: addr.coordinates
          };
        }
      });

      // Calculate meeting point with venue options
      const result = await findOptimalMeetingPoint(apiAddresses, {
        venueTypes: showVenues ? venueTypes : null,
        venueRadius: venueRadius,
        showVenues: showVenues
      });

      // Handle multiple meeting points
      const meetingPointsData = result.allMeetingPoints || [{
        name: result.name,
        coordinates: result.coordinates,
        travel_times: result.travelTimes?.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: tt.duration,
          distance: tt.distance,
          estimated: tt.estimated,
          transit_summary: tt.transitSummary
        })) || []
      }];

      setMeetingPoints(meetingPointsData);
      const routesData = result.allRoutes || [result.routes || []];
      setAllRoutes(routesData);

      // Set current meeting point (first one by default) with initial routes
      const currentPoint = meetingPointsData[0];
      setMeetingPoint({
        name: currentPoint.name,
        coordinates: currentPoint.coordinates,
        travelTimes: currentPoint.travel_times || currentPoint.travelTimes
      });
      setRoutes(routesData[0] || result.routes || []);
      setCurrentMeetingPointIndex(0);

      setVenues(result.venues || []);

      // Trigger animation to results
      setAnimateToResults(true);

      // Show results
      setShowResults(true);
      
    } catch (err) {
      console.error("Error finding meeting point:", err);
      setError(err.message || "Failed to calculate meeting point. Please try again.");
    } finally {
      setIsCalculating(false);
    }
  };

  const updateCurrentMeetingPoint = (index, meetingPointsData = meetingPoints) => {
    if (meetingPointsData.length > 0 && index < meetingPointsData.length) {
      const currentPoint = meetingPointsData[index];
      setMeetingPoint({
        name: currentPoint.name,
        coordinates: currentPoint.coordinates,
        travelTimes: currentPoint.travel_times || currentPoint.travelTimes
      });
      setRoutes(allRoutes[index] || []);
      setCurrentMeetingPointIndex(index);
    }
  };

  const handleMeetingPointChange = (index) => {
    updateCurrentMeetingPoint(index);
  };

  const handleMapBounds = (boundsData) => {
    setMapBounds(boundsData.bounds);
  };

  // Create map markers for all locations
  const createMapMarkers = () => {
    const markers = [];

    // Add markers for addresses
    addresses.forEach((address, index) => {
      if (address.coordinates) {
        markers.push({
          position: address.coordinates,
          title: address.value || `Location ${index + 1}`,
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
  const meetingZoneRadius = meetingPoint && venueRadius ? venueRadius : 0;

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
    // Reset map height to default
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
                <Text style={styles.logoIcon}>
                📍
                </Text>
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
                key={`map-${currentMeetingPointIndex}-${routes.length}`}
                center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
                zoom={meetingPoint ? undefined : defaultMapZoom}
                markers={mapMarkers}
                routes={routes}
                meetingZoneRadius={meetingZoneRadius}
                animateToResults={animateToResults}
                zoomToFitMarkers={false}
                height="100%"
                onBoundsChange={handleMapBounds}
              />
            </View>
          </Animated.View>

          {/* CONTENT BELOW MAP */}
          <SafeAreaView style={styles.contentSafeArea} edges={['left', 'right', 'bottom']}>
            <ScrollView 
              style={styles.contentScrollView} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
            {/* Enhanced Mobile Loading State */}
            {isCalculating && (
              <View style={styles.loadingContainer}>
                <LoadingIndicator 
                  size="large" 
                  text="Finding the perfect meeting spot..." 
                />
              </View>
            )}

            {/* Error State */}
            {error && (
              <View style={styles.errorContainer}>
                <View style={styles.errorIcon}>
                  <MaterialIcons name="error-outline" size={20} color="#f87171" />
                </View>
                <View style={styles.errorContent}>
                  <Text style={styles.errorTitle}>Oops!</Text>
                  <Text style={styles.errorMessage}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => setError(null)}
                    style={styles.errorButton}
                  >
                    <Text style={styles.errorButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Results or Address Form */}
            {showResults && meetingPoint ? (
              <View style={styles.resultsContainer}>
                <MeetingPointResults
                  meetingPoint={meetingPoint}
                  meetingPoints={meetingPoints}
                  currentMeetingPointIndex={currentMeetingPointIndex}
                  setCurrentMeetingPointIndex={handleMeetingPointChange}
                  onStartNewSearch={handleStartNewSearch}
                  onCreateGroup={handleSaveLocation}
                  mode="main"
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
    backgroundColor: '#f8fafc',
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
    color: '#374151',
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
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
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
    color: '#dc2626',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#7f1d1d',
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
    color: '#dc2626',
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
