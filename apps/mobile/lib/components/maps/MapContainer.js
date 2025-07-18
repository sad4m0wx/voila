import React, { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { getGradientColors } from '../../theme/gradients';

const MapContainer = (props = {}) => {
  const {
    center = [2.3522, 48.8566], // [longitude, latitude]
    zoom = 12,
    markers = [],
    routes = [],
    meetingPoint = null,
    venueRadius = 0,
    animateToResults = false,
    height = '100%',
    onBoundsChange = null,
    style = {},
    onMapReady,
    enableRouteAnimation = true, // New prop to enable/disable animation
    routeAnimationDuration = 2000, // Animation duration in ms
    routeAnimationDelay = 500 // Delay before starting animation
  } = props;

  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Route animation state - single progress value for all routes
  const [animationProgress, setAnimationProgress] = useState(0);
  const animationRef = useRef(new Animated.Value(0));

  // Animate routes when they change
  useEffect(() => {
    if (!enableRouteAnimation || !mapReady || routes.length === 0) return;

    // Reset animation
    setAnimationProgress(0);
    animationRef.current.setValue(0);

    // Start animation after delay
    setTimeout(() => {
      Animated.timing(animationRef.current, {
        toValue: 1,
        duration: routeAnimationDuration,
        useNativeDriver: false,
      }).start();
    }, routeAnimationDelay);

    // Add listener to track progress
    const listener = animationRef.current.addListener(({ value }) => {
      setAnimationProgress(value);
    });

    // Cleanup function
    return () => {
      animationRef.current.stopAnimation();
      animationRef.current.removeListener(listener);
    };
  }, [routes, mapReady, enableRouteAnimation, routeAnimationDuration, routeAnimationDelay]);

  // Initial region based on center prop - memoized
  const initialRegion = useMemo(() => ({
    latitude: center[1],
    longitude: center[0],
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }), [center[0], center[1]]);

  // Handle map ready event
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    onMapReady?.();
  }, [onMapReady]);

  // Calculate meeting zone radius (blue circle around meeting point)
  const meetingZoneRadius = useMemo(() => {
    return meetingPoint && venueRadius > 0 ? venueRadius : 0;
  }, [meetingPoint, venueRadius]);

  // Auto-fit map to show all markers and routes when data changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || markers.length === 0 || isAnimating) return;

    const allCoordinates = [];

    // Add marker coordinates
    markers.forEach(marker => {
      if (marker.position && Array.isArray(marker.position) && marker.position.length >= 2) {
        allCoordinates.push({
          latitude: marker.position[1],
          longitude: marker.position[0],
        });
      }
    });

    // Fit to coordinates if we have any
    if (allCoordinates.length > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        if (mapRef.current) {
          if (allCoordinates.length === 1) {
            mapRef.current.animateToRegion({
              ...allCoordinates[0],
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          } else {
            mapRef.current.fitToCoordinates(allCoordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
          setTimeout(() => setIsAnimating(false), 1000);
        }
      }, 500);
    }
  }, [markers, mapReady]);

  // Animate to meeting point when results are available
  useEffect(() => {
    if (!mapRef.current || !mapReady || !animateToResults || !meetingPoint?.coordinates || isAnimating) return;

    setIsAnimating(true);
    setTimeout(() => {
      if (mapRef.current) {
        let latitudeDelta = 0.01;
        let longitudeDelta = 0.01;
        
        if (meetingZoneRadius > 1000) {
          latitudeDelta = 0.02;
          longitudeDelta = 0.02;
        } else if (meetingZoneRadius > 500) {
          latitudeDelta = 0.015;
          longitudeDelta = 0.015;
        }

        mapRef.current.animateToRegion({
          latitude: meetingPoint.coordinates[1],
          longitude: meetingPoint.coordinates[0],
          latitudeDelta,
          longitudeDelta,
        }, 1500);
        setTimeout(() => setIsAnimating(false), 1500);
      }
    }, 500);
  }, [animateToResults, meetingPoint, meetingZoneRadius, mapReady]);

  // Get marker color based on type and index using gradient colors - memoized
  const getMarkerColor = useCallback((type, index = 0) => {
    const gradientColorSets = [
      getGradientColors('blueToMagenta')[0],
      getGradientColors('sunsetOrange')[0],
      getGradientColors('purpleToViolet')[0],
      getGradientColors('greenEmerald')[0],
      getGradientColors('crimsonRed')[0]
    ];
    
    switch (type) {
      case 'meeting-point':
        return getGradientColors('crimsonRed')[0];
      case 'venue':
        return getGradientColors('sunsetOrange')[0];
      case 'location':
      default:
        return gradientColorSets[index % gradientColorSets.length];
    }
  }, []);

  // Get marker icon based on type - memoized
  const getMarkerIcon = useCallback((type) => {
    switch (type) {
      case 'meeting-point':
        return 'flag';
      case 'venue':
        return 'restaurant';
      case 'location':
      default:
        return 'place';
    }
  }, []);

  // Render individual marker - memoized
  const renderMarker = useCallback((marker, index) => {
    if (!marker.position || marker.position.length < 2) {
      return null;
    }

    const coordinate = {
      latitude: marker.position[1],
      longitude: marker.position[0],
    };

    return (
      <Marker
        key={`marker-${marker.type}-${index}`}
        coordinate={coordinate}
        title={marker.title}
        description={marker.info}
        tracksViewChanges={false}
      >
        <View style={[
          styles.customMarker, 
          { backgroundColor: getMarkerColor(marker.type, index) }
        ]}>
          <MaterialIcons 
            name={getMarkerIcon(marker.type)} 
            size={16} 
            color="white" 
          />
          {marker.number && (
            <View style={styles.markerNumber}>
              <Text style={styles.markerNumberText}>{marker.number}</Text>
            </View>
          )}
        </View>
      </Marker>
    );
  }, [getMarkerColor, getMarkerIcon]);

  // Helper function to get step color - memoized
  const getStepColor = useCallback((step, routeColor) => {
    // Ensure we have a valid step with mode
    if (!step || !step.mode) {
      return routeColor || '#3b82f6';
    }

    const mode = step.mode.toLowerCase();
    
    if (mode === 'walking' || mode === 'walk') {
      return '#059669';
    }
    
    if (mode === 'transit') {
      // Check for transit line color first
      if (step.transit_details?.line?.color) {
        const lineColor = step.transit_details.line.color;
        // Ensure it's a valid hex color
        if (lineColor && typeof lineColor === 'string') {
          return lineColor.startsWith('#') ? lineColor : `#${lineColor}`;
        }
      }
      // Fallback transit color
      return '#8B5CF6';
    }
    
    if (mode === 'driving' || mode === 'car') {
      return '#2563EB';
    }
    
    // Default fallback
    return routeColor || '#3b82f6';
  }, []);

  // Render route with steps - memoized
  const renderRoute = useCallback((route, routeIndex) => {
    if (!route) return null;

    const polylines = [];
    
    // Prioritize steps over geometry to avoid duplicate rendering
    if (route.steps && Array.isArray(route.steps) && route.steps.length > 0) {
      const numSteps = route.steps.length;
      // Divide animation progress among steps
      for (let stepIndex = 0; stepIndex < numSteps; stepIndex++) {
        const step = route.steps[stepIndex];
        if (!step.geometry?.coordinates || !Array.isArray(step.geometry.coordinates)) continue;
        const stepCoords = step.geometry.coordinates;
        if (stepCoords.length < 2) continue;
        const allCoordinates = stepCoords
          .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
          .map(coord => ({ latitude: coord[1], longitude: coord[0] }));
        if (allCoordinates.length < 2) continue;

        let coordinates = [];
        if (enableRouteAnimation) {
          if (animationProgress <= 0.01) {
            // Don't render anything if animation hasn't started
            continue;
          }
          // Step's animation window
          const stepStart = stepIndex / numSteps;
          const stepEnd = (stepIndex + 1) / numSteps;
          const stepProgress = (animationProgress - stepStart) / (stepEnd - stepStart);

          if (stepProgress <= 0) {
            // Not started yet
            continue;
          } else if (stepProgress >= 1) {
            // Fully drawn
            coordinates = allCoordinates;
          } else {
            // Animate this step
            const coordinateCount = Math.max(2, Math.floor(allCoordinates.length * stepProgress));
            coordinates = allCoordinates.slice(0, coordinateCount);
            // Smooth interpolation for the last segment
            if (coordinateCount < allCoordinates.length && coordinateCount > 0) {
              const lastIndex = coordinateCount - 1;
              const nextIndex = coordinateCount;
              const progress = (allCoordinates.length * stepProgress) - coordinateCount;
              if (progress > 0 && nextIndex < allCoordinates.length) {
                const lastCoord = allCoordinates[lastIndex];
                const nextCoord = allCoordinates[nextIndex];
                const interpolatedCoord = {
                  latitude: lastCoord.latitude + (nextCoord.latitude - lastCoord.latitude) * progress,
                  longitude: lastCoord.longitude + (nextCoord.longitude - lastCoord.longitude) * progress
                };
                coordinates = [...coordinates.slice(0, -1), interpolatedCoord];
              }
            }
          }
        } else {
          coordinates = allCoordinates;
        }
        if (coordinates.length < 2) continue;
        
        // Get step color early and ensure it's applied correctly
        const stepColor = getStepColor(step, route.color);
        const uniqueKey = `route-${routeIndex}-step-${stepIndex}`;

        polylines.push(
          <Polyline
            key={uniqueKey}
            coordinates={coordinates}
            strokeColors={[stepColor]}
            strokeWidth={6}
            geodesic={true}
            tappable={false}
          />
        );
      }
      return polylines;
    }
    
    // Only render geometry if there are no steps at all
    if (route.geometry?.coordinates && route.geometry.coordinates.length > 0 && (!route.steps || route.steps.length === 0)) {
      // Only use geometry if there are no steps to avoid duplicate rendering
      const allCoordinates = route.geometry.coordinates
        .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
        .map(coord => ({ latitude: coord[1], longitude: coord[0] }));
      if (allCoordinates.length >= 2) {
        let coordinates = [];
        if (enableRouteAnimation) {
          if (animationProgress <= 0.01) {
            return polylines;
          }
          const coordinateCount = Math.max(2, Math.floor(allCoordinates.length * animationProgress));
          coordinates = allCoordinates.slice(0, coordinateCount);
          if (coordinateCount < allCoordinates.length && coordinateCount > 0) {
            const lastIndex = coordinateCount - 1;
            const nextIndex = coordinateCount;
            const progress = (allCoordinates.length * animationProgress) - coordinateCount;
            if (progress > 0 && nextIndex < allCoordinates.length) {
              const lastCoord = allCoordinates[lastIndex];
              const nextCoord = allCoordinates[nextIndex];
              const interpolatedCoord = {
                latitude: lastCoord.latitude + (nextCoord.latitude - lastCoord.latitude) * progress,
                longitude: lastCoord.longitude + (nextCoord.longitude - lastCoord.longitude) * progress
              };
              coordinates = [...coordinates.slice(0, -1), interpolatedCoord];
            }
          }
        } else {
          coordinates = allCoordinates;
        }
        if (coordinates.length >= 2) {
          polylines.push(
            <Polyline
              key={`route-main-${routeIndex}`}
              coordinates={coordinates}
              strokeColor={route.color || '#3b82f6'}
              strokeWidth={6}
              geodesic={true}
              tappable={false}
            />
          );
        }
      }
    }
    return polylines;
  }, [getStepColor, enableRouteAnimation, animationProgress]);

  // Render meeting zone circle - memoized
  const renderMeetingZoneCircle = useCallback(() => {
    if (!meetingPoint?.coordinates || meetingZoneRadius <= 0) return null;

    return (
      <Circle
        key={`meeting-zone-${meetingZoneRadius}`}
        center={{
          latitude: meetingPoint.coordinates[1],
          longitude: meetingPoint.coordinates[0],
        }}
        radius={meetingZoneRadius}
        strokeColor="rgba(168, 85, 247, 0.5)"
        fillColor="rgba(168, 85, 247, 0.15)"
        strokeWidth={2}
      />
    );
  }, [meetingPoint, meetingZoneRadius]);

  // Handle region change and notify parent - memoized
  const onRegionChangeComplete = useCallback((newRegion) => {
    if (!onBoundsChange || isAnimating) return;
    
    const bounds = {
      northeast: [
        newRegion.longitude + newRegion.longitudeDelta / 2,
        newRegion.latitude + newRegion.latitudeDelta / 2
      ],
      southwest: [
        newRegion.longitude - newRegion.longitudeDelta / 2,
        newRegion.latitude - newRegion.latitudeDelta / 2
      ]
    };
    onBoundsChange({ bounds });
  }, [onBoundsChange, isAnimating]);

  let mapContent = null;
  if (mapReady) {
    mapContent = (
      <>
        {markers.map((marker, index) => renderMarker(marker, index))}
        {routes.map((route, index) => renderRoute(route, index))}
        {renderMeetingZoneCircle()}
      </>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#3b82f6"
        loadingBackgroundColor="#f3f4f6"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomTapEnabled={false}
        {...Platform.select({
          ios: {
            maxZoomLevel: 18,
            minZoomLevel: 10
          },
          android: {
            maxZoomLevel: 18,
            minZoomLevel: 10
          }
        })}
      >
        {mapContent}
      </MapView>
    </View>
  );
};

// Enhanced memoization
const areEqual = (prevProps, nextProps) => {
  if (prevProps.height !== nextProps.height) return false;
  if (prevProps.center[0] !== nextProps.center[0] || prevProps.center[1] !== nextProps.center[1]) return false;
  if (prevProps.markers?.length !== nextProps.markers?.length) return false;
  if (prevProps.routes?.length !== nextProps.routes?.length) return false;
  if (prevProps.meetingPoint !== nextProps.meetingPoint) return false;
  if (prevProps.animateToResults !== nextProps.animateToResults) return false;
  if (prevProps.venueRadius !== nextProps.venueRadius) return false;
  if (prevProps.enableRouteAnimation !== nextProps.enableRouteAnimation) return false;
  if (prevProps.routeAnimationDuration !== nextProps.routeAnimationDuration) return false;
  if (prevProps.routeAnimationDelay !== nextProps.routeAnimationDelay) return false;
  return true;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerNumber: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'white',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  markerNumberText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
});

export default memo(MapContainer, areEqual); 