import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  PanResponder,
  Animated,
  Dimensions
} from 'react-native';
import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import RouteDetails from './RouteDetails';

const { width: screenWidth } = Dimensions.get('window');

const MeetingPointDisplay = ({
  meetingPoint,
  routes = [],
  meetingPoints = [], // All available meeting points
  currentMeetingPointIndex = 0, // Current selected index
  onMeetingPointChange, // Callback when user changes meeting point
  onStartNewSearch,
  onCreateGroup
}) => {
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  if (!meetingPoint) {
    return null;
  }

  const hasMultipleMeetingPoints = meetingPoints && meetingPoints.length > 1;

  // Calculate travel time stats for current meeting point
  const travelTimes = meetingPoint.travelTimes || [];
  const durations = travelTimes.map(tt => parseInt(tt.duration) || 0);
  const avgTravelTime = durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
  const maxTravelTime = durations.length > 0 ? Math.max(...durations) : 0;

  // Pan responder for swipe gestures with animation
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      // Only start if we have multiple meeting points and it's clearly horizontal
      return hasMultipleMeetingPoints && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Be more permissive but still clearly horizontal
      return hasMultipleMeetingPoints && 
             Math.abs(gestureState.dx) > 10 && 
             Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
    },
    onPanResponderTerminationRequest: () => false, // Don't let other components steal the gesture
    onPanResponderGrant: (evt, gestureState) => {
      // Start the drag - add slight scale down effect
      Animated.spring(scale, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    },
    onPanResponderMove: (evt, gestureState) => {
      // Follow the finger with more resistance and smaller range
      const maxDrag = screenWidth * 0.25; // Reduced from 0.3 to 0.25
      const resistance = 0.5; // Increased resistance from 0.6 to 0.5
      const dragValue = Math.max(-maxDrag, Math.min(maxDrag, gestureState.dx * resistance));
      
      translateX.setValue(dragValue);
      
      // Fade out slightly when dragging far
      const fadeAmount = Math.abs(dragValue) / maxDrag;
      opacity.setValue(1 - fadeAmount * 0.2); // Reduced fade from 0.3 to 0.2
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = 50; // Reduced threshold for easier triggering
      const velocity = gestureState.vx;
      
      // Reset scale
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
      
      // More lenient conditions for changing page
      const shouldChangePage = Math.abs(gestureState.dx) > swipeThreshold || Math.abs(velocity) > 0.25;
      
      if (shouldChangePage) {
        if (gestureState.dx > 0 || velocity > 0.25) {
          // Swipe right or fast right velocity - go to previous
          animateToDirection('right', () => navigateToPrevious());
        } else if (gestureState.dx < 0 || velocity < -0.25) {
          // Swipe left or fast left velocity - go to next
          animateToDirection('left', () => navigateToNext());
        } else {
          // Spring back to center
          springToCenter();
        }
      } else {
        // Spring back to center
        springToCenter();
      }
    },
  });

  const animateToDirection = (direction, callback) => {
    const targetX = direction === 'right' ? screenWidth * 0.8 : -screenWidth * 0.8; // Reduced distance
    
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 150, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Call the navigation callback
      callback();
      
      // Reset position for new content
      translateX.setValue(direction === 'right' ? -screenWidth * 0.8 : screenWidth * 0.8);
      
      // Animate in the new content
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 300,
          friction: 20,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  const springToCenter = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Reset animation when meeting point changes from other sources (e.g., dot navigation)
  useEffect(() => {
    translateX.setValue(0);
    opacity.setValue(1);
    scale.setValue(1);
  }, [currentMeetingPointIndex]);

  const navigateToPrevious = () => {
    if (hasMultipleMeetingPoints && onMeetingPointChange) {
      const newIndex = currentMeetingPointIndex === 0 
        ? meetingPoints.length - 1 
        : currentMeetingPointIndex - 1;
      onMeetingPointChange(newIndex);
    }
  };

  const navigateToNext = () => {
    if (hasMultipleMeetingPoints && onMeetingPointChange) {
      const newIndex = currentMeetingPointIndex === meetingPoints.length - 1 
        ? 0 
        : currentMeetingPointIndex + 1;
      onMeetingPointChange(newIndex);
    }
  };

  const navigateToIndex = (index) => {
    if (hasMultipleMeetingPoints && onMeetingPointChange && index >= 0 && index < meetingPoints.length) {
      onMeetingPointChange(index);
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Share Location',
      'Sharing functionality will be implemented in the next phase.',
      [{ text: 'OK' }]
    );
  };

  const handleOpenInMaps = async () => {
    if (!meetingPoint.coordinates) return;
    
    const [lng, lat] = meetingPoint.coordinates;
    
    // Create URLs for different map apps
    const googleMapsUrl = Platform.select({
      ios: `http://maps.google.com/maps?daddr=${lat},${lng}`,
      android: `http://maps.google.com/maps?daddr=${lat},${lng}`,
    });
    
    const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}`;
    
    try {
      // Try to open Google Maps first
      const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogle) {
        await Linking.openURL(googleMapsUrl);
      } else if (Platform.OS === 'ios') {
        // Fallback to Apple Maps on iOS
        const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
        if (canOpenApple) {
          await Linking.openURL(appleMapsUrl);
        } else {
          Alert.alert(
            'No Maps App',
            'No maps application found on your device.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'No Maps App',
          'Google Maps is not installed on your device.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert(
        'Error',
        'Failed to open maps application.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        {/* New Search Button - Top Priority - NOT SWIPEABLE */}
        <TouchableOpacity style={styles.primaryButton} onPress={onStartNewSearch}>
          <View style={styles.primaryButtonContent}>
            <Text style={styles.primaryButtonText}>New Search</Text>
          </View>
        </TouchableOpacity>

        {/* Travel Time Stats Summary - NOT SWIPEABLE - Updates with data */}
        {travelTimes.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgTravelTime}</Text>
              <Text style={styles.statLabel}>Avg. Travel Time</Text>
              <Text style={styles.statUnit}>min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{maxTravelTime}</Text>
              <Text style={styles.statLabel}>Max Travel Time</Text>
              <Text style={styles.statUnit}>min</Text>
            </View>
          </View>
        )}

        {/* Multiple Meeting Points Navigation - SWIPEABLE */}
        {hasMultipleMeetingPoints && (
          <Animated.View 
            style={[
              styles.navigationContainer,
              {
                transform: [
                  { translateX: translateX },
                  { scale: scale }
                ],
                opacity: opacity,
              }
            ]} 
            {...(hasMultipleMeetingPoints ? panResponder.panHandlers : {})}
          >
            <View style={styles.navigationContent}>
              <View style={styles.navigationLeft}>
                <MaterialIcons name="place" size={16} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={styles.navigationTitle}>Meeting Points</Text>
                <View style={styles.dotsContainer}>
                  {meetingPoints.map((_, index) => (
                    <TouchableOpacity
                      key={`dot-${index}`}
                      style={[
                        styles.dot,
                        index === currentMeetingPointIndex ? styles.dotActive : styles.dotInactive
                      ]}
                      onPress={() => navigateToIndex(index)}
                    />
                  ))}
                </View>
              </View>
            </View>
            
            {/* Swipe hint for mobile */}
            <Text style={styles.swipeHint}>← Swipe →</Text>
          </Animated.View>
        )}

        {/* SWIPEABLE CONTENT - Only travel times section responds to swipe gestures */}
        {meetingPoint.travelTimes && meetingPoint.travelTimes.length > 0 && (
          <Animated.View 
            style={[
              styles.swipeableContent,
              {
                transform: [
                  { translateX: translateX },
                  { scale: scale }
                ],
                opacity: opacity,
              }
            ]} 
            {...(hasMultipleMeetingPoints ? panResponder.panHandlers : {})}
          >
            <View style={styles.travelTimesContainer}>
              <Text style={styles.sectionTitle}>Travel Times</Text>
              {meetingPoint.travelTimes.map((travelTime, index) => (
                <View key={`travel-time-${travelTime.id || index}`} style={styles.travelTimeItem}>
                  <View style={styles.travelTimeInfo}>
                    <Text style={styles.travelTimeAddress} numberOfLines={2}>
                      {travelTime.address}
                    </Text>
                    <View style={styles.travelTimeDetails}>
                      <View style={styles.timeDetail}>
                        <MaterialIcons name="schedule" size={12} color="#10b981" />
                        <Text style={styles.travelTimeDuration}>
                          {travelTime.duration} min
                        </Text>
                      </View>
                      {/*travelTime.distance && (
                        <View style={styles.timeDetail}>
                          <MaterialIcons name="straighten" size={12} color="#64748b" />
                          <Text style={styles.travelTimeDistance}>
                            {travelTime.distance}
                          </Text>
                        </View>
                      )*/}
                      {travelTime.estimated && (
                        <Text style={styles.estimatedBadge}>~</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Route Details Toggle - NOT SWIPEABLE - Updates with data */}
        {routes && routes.length > 0 && (
          <TouchableOpacity 
            style={styles.routeToggleButton}
            onPress={() => setShowRouteDetails(!showRouteDetails)}
          >
            <MaterialIcons name="route" size={14} color="#475569" style={{ marginRight: 6 }} />
            <Text style={styles.routeToggleText}>
              Detailed Routes
            </Text>
            <MaterialIcons 
              name={showRouteDetails ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={16} 
              color="#64748b" 
            />
          </TouchableOpacity>
        )}

        {/* Route Details - NOT SWIPEABLE - Updates with data */}
        {showRouteDetails && routes && routes.length > 0 && (
          <View style={styles.routeDetailsContainer}>
            <RouteDetails 
              routes={routes}
              travelTimes={meetingPoint.travelTimes}
            />
          </View>
        )}

        {/* Secondary Actions - NOT SWIPEABLE - Static */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenInMaps}>
            <MaterialIcons name="map" size={14} color="#475569" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Open in Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
            <Feather name="share-2" size={14} color="#475569" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Optional Group Button - NOT SWIPEABLE - Static */}
        {onCreateGroup && (
          <TouchableOpacity style={styles.groupButton} onPress={onCreateGroup}>
            <View style={styles.groupButtonContent}>
              <FontAwesome5 name="users" size={14} color="white" style={styles.buttonIcon} />
              <Text style={styles.groupButtonText}>Create a Group</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
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
  primaryButton: {
    backgroundColor: '#6366f1', // Indigo
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
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
  buttonIcon: {
    marginRight: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  meetingPointName: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  travelTimesContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569', // Slate
    marginBottom: 10,
  },
  travelTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  travelTimeInfo: {
    flex: 1,
  },
  travelTimeAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155', // Slate
    marginBottom: 6,
  },
  travelTimeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  travelTimeDuration: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
  travelTimeDistance: {
    fontSize: 11,
    color: '#64748b', // Slate
    fontWeight: '500',
  },
  estimatedBadge: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: 'bold',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  routeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  routeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
  },
  routeDetailsContainer: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  secondaryButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  groupButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  groupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  navigationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navigationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactive: {
    backgroundColor: '#cbd5e1',
  },
  navigationRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  navButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  navigationCounter: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    marginHorizontal: 8,
    minWidth: 40,
    textAlign: 'center',
  },
  swipeHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 10,
  },
  meetingPointCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  statsContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    marginHorizontal: 16,
  },
  swipeableContent: {
    flex: 1,
  },
});

export default MeetingPointDisplay; 