import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { findOptimalMeetingPoint } from '../../lib';
import AddressForm from '../../lib/components/meeting/AddressForm';
import MeetingPointDisplay from '../../lib/components/meeting/MeetingPointDisplay';
import MapContainer from '../../lib/components/maps/MapContainer';
import MetroBackground from '../../lib/components/core/MetroBackground';
import { LoadingIndicator } from '../../lib/components/utils';
import { defaultMapCenter, defaultMapZoom } from '../../lib/config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

  // Venue options
  const [showVenues, setShowVenues] = useState(true);
  const [venueTypes, setVenueTypes] = useState(['restaurant']);
  const [venueRadius, setVenueRadius] = useState(500);

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
      // Validate inputs
      const filledAddresses = addresses.filter(addr => addr.value.trim());
      if (filledAddresses.length < 2) {
        throw new Error("Please enter at least 2 addresses");
      }

      // Calculate meeting point with venue options
      const result = await findOptimalMeetingPoint(filledAddresses, {
        venueTypes: showVenues ? venueTypes : null,
        venueRadius: venueRadius,
        showVenues: showVenues
      });

      console.log('API Result:', result); // Debug log

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
        travelTimes: currentPoint.travel_times
      });
      setRoutes(routesData[0] || result.routes || []);
      setCurrentMeetingPointIndex(0);
      console.log('Initial routes set:', routesData[0] || result.routes || []);

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
        travelTimes: currentPoint.travel_times
      });
      setRoutes(allRoutes[index] || []);
      setCurrentMeetingPointIndex(index);
      console.log('Routes set:', allRoutes[index] || []); // Debug log
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
      {/* Enhanced Background with Multiple Layers */}
      <View style={styles.backgroundContainer}>
        <View style={styles.gradientOverlay} />
        <View style={styles.radialOverlay} />
        <MetroBackground />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {/* MAP AT TOP - Priority Position */}
          <View style={[
            styles.mapArea,
            { height: mapExpanded ? 320 : showResults ? 200 : 240 }
          ]}>
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
                      size={16} 
                      color="#6b7280" 
                    />
                  </TouchableOpacity>
                )}
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
          </View>

          {/* CONTENT BELOW MAP */}
          <ScrollView 
            style={styles.contentScrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Enhanced Mobile Loading State */}
            {isCalculating && (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingAnimation}>
                  {/* Animated loading rings */}
                  <View style={styles.loadingRings}>
                    <View style={styles.loadingRingOuter} />
                    <View style={styles.loadingRingMiddle} />
                    <View style={styles.loadingRingInner} />
                  </View>
                  {/* Floating dots animation */}
                  <View style={styles.floatingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
                <Text style={styles.loadingText}>Finding the perfect meeting spot...</Text>
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
              <MeetingPointDisplay
                meetingPoint={meetingPoint}
                routes={routes}
                meetingPoints={meetingPoints}
                currentMeetingPointIndex={currentMeetingPointIndex}
                onMeetingPointChange={handleMeetingPointChange}
                onStartNewSearch={handleStartNewSearch}
                onCreateGroup={handleSaveLocation}
              />
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
        </View>
      </SafeAreaView>
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
    zIndex: 1,
  },
  gradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#f1f5f9', // Softer slate background
    opacity: 0.9,
  },
  radialOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(139, 92, 246, 0.03)', // Very subtle purple tint
  },
  safeArea: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 44 : 24, // Consistent top padding
  },
  mainContent: {
    flex: 1,
  },
  mapArea: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#8b5cf6', // Purple shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerControls: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  logoIcon: {
    marginRight: 6,
  },
  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366f1', // Indigo color like SvelteKit
  },
  mapControls: {
    flexDirection: 'row',
    gap: 6,
  },
  mapControlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(236, 254, 255, 0.6)', // Softer cyan background
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  contentScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 80, // Space for smaller tab bar
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  loadingAnimation: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
  },
  loadingRings: {
    width: 60,
    height: 60,
    position: 'relative',
  },
  loadingRingOuter: {
    position: 'absolute',
    inset: 0,
    borderWidth: 3,
    borderColor: '#e0e7ff', // Light indigo
    borderRadius: 30,
  },
  loadingRingMiddle: {
    position: 'absolute',
    inset: 0,
    borderWidth: 3,
    borderColor: '#6366f1', // Indigo
    borderTopColor: 'transparent',
    borderRadius: 30,
  },
  loadingRingInner: {
    position: 'absolute',
    inset: 6,
    borderWidth: 2,
    borderColor: '#8b5cf6', // Purple
    borderBottomColor: 'transparent',
    borderRadius: 24,
  },
  floatingDots: {
    position: 'absolute',
    top: -6,
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dot1: {
    backgroundColor: '#6366f1', // Indigo
  },
  dot2: {
    backgroundColor: '#8b5cf6', // Purple
  },
  dot3: {
    backgroundColor: '#06b6d4', // Cyan
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569', // Slate
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#f87171', // Softer red
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorIcon: {
    marginRight: 10,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 12,
    color: '#991b1b',
    marginBottom: 12,
    lineHeight: 16,
  },
  errorButton: {
    backgroundColor: '#f87171', // Softer red
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  errorButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 16,
  },
}); 