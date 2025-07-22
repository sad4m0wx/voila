import React, { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { getGradientColors } from '../../theme/gradients';

const DEFAULT_CENTER = [2.3522, 48.8566];
const DEFAULT_ZOOM = 12;
const DEFAULT_DELTAS = { latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
const EDGE_PADDING = { top: 50, right: 50, bottom: 50, left: 50 };
const GRADIENT_COLOR_CACHE = new Map();

const getGradientColorCached = (gradientName) => {
  if (!GRADIENT_COLOR_CACHE.has(gradientName)) {
    GRADIENT_COLOR_CACHE.set(gradientName, getGradientColors(gradientName));
  }
  return GRADIENT_COLOR_CACHE.get(gradientName);
};

const MARKER_COLOR_SETS = [
  getGradientColorCached('blueToMagenta')[0],
  getGradientColorCached('sunsetOrange')[0],
  getGradientColorCached('purpleToViolet')[0],
  getGradientColorCached('greenEmerald')[0],
  getGradientColorCached('crimsonRed')[0]
];

const MARKER_COLORS = {
  'meeting-point': getGradientColorCached('crimsonRed')[0],
  'venue': getGradientColorCached('sunsetOrange')[0],
  'location': null 
};

const MARKER_ICONS = {
  'meeting-point': 'flag',
  'venue': 'restaurant',
  'location': 'place'
};

const OptimizedMarker = memo(({ marker, index, getMarkerColor, getMarkerIcon }) => {
  if (!marker.position || marker.position.length < 2) return null;

  const coordinate = useMemo(() => ({
    latitude: marker.position[1],
    longitude: marker.position[0],
  }), [marker.position]);

  const markerColor = useMemo(() => 
    getMarkerColor(marker.type, index), 
    [marker.type, index, getMarkerColor]
  );

  const markerIcon = useMemo(() => 
    getMarkerIcon(marker.type), 
    [marker.type, getMarkerIcon]
  );

  return (
    <Marker
      key={`marker-${marker.type}-${index}-${marker.position[0]}-${marker.position[1]}`}
      coordinate={coordinate}
      title={marker.title}
      description={marker.info}
      tracksViewChanges={false} 
    >
      <View style={[styles.customMarker, { backgroundColor: markerColor }]}>
        <MaterialIcons name={markerIcon} size={16} color="white" />
        {marker.number && (
          <View style={styles.markerNumber}>
            <Text style={styles.markerNumberText}>{marker.number}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
});

const Route = memo(({ route, routeIndex, animationProgress, enableRouteAnimation, getStepColor }) => {
  const renderRoutePolylines = useMemo(() => {
    if (!route) return [];

    const polylines = [];
    
    // Prioritize steps over geometry
    if (route.steps?.length > 0) {
      const numSteps = route.steps.length;
      
      for (let stepIndex = 0; stepIndex < numSteps; stepIndex++) {
        const step = route.steps[stepIndex];
        if (!step.geometry?.coordinates?.length || step.geometry.coordinates.length < 2) continue;
        
        const allCoordinates = step.geometry.coordinates
          .filter(coord => Array.isArray(coord) && coord.length >= 2 && 
                          !isNaN(coord[0]) && !isNaN(coord[1]))
          .map(coord => ({ latitude: coord[1], longitude: coord[0] }));
        
        if (allCoordinates.length < 2) continue;

        let coordinates = [];
        
        if (enableRouteAnimation && animationProgress > 0.01) {
          const stepStart = stepIndex / numSteps;
          const stepEnd = (stepIndex + 1) / numSteps;
          const stepProgress = Math.max(0, Math.min(1, (animationProgress - stepStart) / (stepEnd - stepStart)));

          if (stepProgress <= 0) continue;
          
          if (stepProgress >= 1) {
            coordinates = allCoordinates;
          } else {
            const coordinateCount = Math.max(2, Math.floor(allCoordinates.length * stepProgress));
            coordinates = allCoordinates.slice(0, coordinateCount);
            
            // Smooth interpolation for partial segments
            const remainingProgress = (allCoordinates.length * stepProgress) - coordinateCount;
            if (remainingProgress > 0 && coordinateCount < allCoordinates.length) {
              const lastCoord = allCoordinates[coordinateCount - 1];
              const nextCoord = allCoordinates[coordinateCount];
              const interpolatedCoord = {
                latitude: lastCoord.latitude + (nextCoord.latitude - lastCoord.latitude) * remainingProgress,
                longitude: lastCoord.longitude + (nextCoord.longitude - lastCoord.longitude) * remainingProgress
              };
              coordinates = [...coordinates.slice(0, -1), interpolatedCoord];
            }
          }
        } else if (!enableRouteAnimation) {
          coordinates = allCoordinates;
        }
        
        if (coordinates.length >= 2) {
          polylines.push(
            <Polyline
              key={`route-${routeIndex}-step-${stepIndex}`}
              coordinates={coordinates}
              strokeColors={[getStepColor(step, route.color)]}
              strokeWidth={6}
              geodesic={true}
              tappable={false}
            />
          );
        }
      }
    } 
    // Fallback to geometry if no steps
    else if (route.geometry?.coordinates?.length >= 2) {
      const allCoordinates = route.geometry.coordinates
        .filter(coord => Array.isArray(coord) && coord.length >= 2 && 
                        !isNaN(coord[0]) && !isNaN(coord[1]))
        .map(coord => ({ latitude: coord[1], longitude: coord[0] }));
      
      if (allCoordinates.length >= 2) {
        let coordinates = [];
        
        if (enableRouteAnimation && animationProgress > 0.01) {
          const coordinateCount = Math.max(2, Math.floor(allCoordinates.length * animationProgress));
          coordinates = allCoordinates.slice(0, coordinateCount);
          
          const remainingProgress = (allCoordinates.length * animationProgress) - coordinateCount;
          if (remainingProgress > 0 && coordinateCount < allCoordinates.length) {
            const lastCoord = allCoordinates[coordinateCount - 1];
            const nextCoord = allCoordinates[coordinateCount];
            const interpolatedCoord = {
              latitude: lastCoord.latitude + (nextCoord.latitude - lastCoord.latitude) * remainingProgress,
              longitude: lastCoord.longitude + (nextCoord.longitude - lastCoord.longitude) * remainingProgress
            };
            coordinates = [...coordinates.slice(0, -1), interpolatedCoord];
          }
        } else if (!enableRouteAnimation) {
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
  }, [route, routeIndex, animationProgress, enableRouteAnimation, getStepColor]);

  return <>{renderRoutePolylines}</>;
});

const MapContainer = memo((props = {}) => {
  const {
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    markers = [],
    routes = [],
    meetingPoint = null,
    venueRadius = 0,
    animateToResults = false,
    height = '100%',
    onBoundsChange = null,
    style = {},
    onMapReady,
    enableRouteAnimation = true,
    routeAnimationDuration = 2000,
    routeAnimationDelay = 500
  } = props;

  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const animationRef = useRef(new Animated.Value(0));
  
  // Memoized utility functions with stable references
  const getMarkerColor = useCallback((type, index = 0) => {
    return MARKER_COLORS[type] || MARKER_COLOR_SETS[index % MARKER_COLOR_SETS.length];
  }, []);

  const getMarkerIcon = useCallback((type) => {
    return MARKER_ICONS[type] || MARKER_ICONS.location;
  }, []);

  const getStepColor = useCallback((step, routeColor) => {
    if (!step?.mode) return routeColor || '#3b82f6';

    const mode = step.mode.toLowerCase();
    
    if (mode === 'walking' || mode === 'walk') return '#059669';
    
    if (mode === 'transit') {
      const lineColor = step.transit_details?.line?.color;
      if (lineColor && typeof lineColor === 'string') {
        return lineColor.startsWith('#') ? lineColor : `#${lineColor}`;
      }
      return '#8B5CF6';
    }
    
    if (mode === 'driving' || mode === 'car') return '#2563EB';
    
    return routeColor || '#3b82f6';
  }, []);

  // Memoized initial region
  const initialRegion = useMemo(() => ({
    latitude: center[1],
    longitude: center[0],
    ...DEFAULT_DELTAS,
  }), [center[0], center[1]]);

  // Memoized meeting zone radius
  const meetingZoneRadius = useMemo(() => 
    meetingPoint && venueRadius > 0 ? venueRadius : 0, 
    [meetingPoint, venueRadius]
  );

  // Stable map ready handler
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    onMapReady?.();
  }, [onMapReady]);

  // Optimized route animation effect with cleanup
  useEffect(() => {
    if (!enableRouteAnimation || !mapReady || routes.length === 0) {
      setAnimationProgress(0);
      return;
    }

    setAnimationProgress(0);
    animationRef.current.setValue(0);

    const timeoutId = setTimeout(() => {
      const animation = Animated.timing(animationRef.current, {
        toValue: 1,
        duration: routeAnimationDuration,
        useNativeDriver: false,
      });

      const listener = animationRef.current.addListener(({ value }) => {
        setAnimationProgress(value);
      });

      animation.start();

      return () => {
        animation.stop();
        animationRef.current.removeListener(listener);
      };
    }, routeAnimationDelay);

    return () => {
      clearTimeout(timeoutId);
      animationRef.current.stopAnimation();
    };
  }, [routes.length, mapReady, enableRouteAnimation, routeAnimationDuration, routeAnimationDelay]);

  // Optimized auto-fit effect with debouncing
  useEffect(() => {
    if (!mapRef.current || !mapReady || markers.length === 0 || isAnimating) return;

    const allCoordinates = markers
      .filter(marker => marker.position?.length >= 2)
      .map(marker => ({
        latitude: marker.position[1],
        longitude: marker.position[0],
      }));

    if (allCoordinates.length === 0) return;

    setIsAnimating(true);
    
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      try {
        if (allCoordinates.length === 1) {
          mapRef.current.animateToRegion({
            ...allCoordinates[0],
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        } else {
          mapRef.current.fitToCoordinates(allCoordinates, {
            edgePadding: EDGE_PADDING,
            animated: true,
          });
        }
        
        setTimeout(() => setIsAnimating(false), 1000);
      } catch (error) {
        console.warn('Map animation failed:', error);
        setIsAnimating(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [markers.length, mapReady]); // Only depend on length to avoid excessive recalculation

  // Optimized meeting point animation effect
  useEffect(() => {
    if (!mapRef.current || !mapReady || !animateToResults || 
        !meetingPoint?.coordinates || isAnimating) return;

    setIsAnimating(true);
    
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      try {
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
      } catch (error) {
        console.warn('Meeting point animation failed:', error);
        setIsAnimating(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [animateToResults, meetingPoint?.coordinates?.[0], meetingPoint?.coordinates?.[1], meetingZoneRadius, mapReady]);

  // Memoized markers rendering
  const optimizedMarkers = useMemo(() => {
    if (!mapReady || markers.length === 0) return [];
    
    return markers.map((marker, index) => (
      <OptimizedMarker
        key={`marker-${marker.type}-${index}-${marker.position?.[0]}-${marker.position?.[1]}`}
        marker={marker}
        index={index}
        getMarkerColor={getMarkerColor}
        getMarkerIcon={getMarkerIcon}
      />
    ));
  }, [markers, mapReady, getMarkerColor, getMarkerIcon]);

  // Memoized routes rendering
  const optimizedRoutes = useMemo(() => {
    if (!mapReady || routes.length === 0) return [];
    
    return routes.map((route, index) => (
      <Route
        key={`route-${index}-${route?.steps?.length || 0}`}
        route={route}
        routeIndex={index}
        animationProgress={animationProgress}
        enableRouteAnimation={enableRouteAnimation}
        getStepColor={getStepColor}
      />
    ));
  }, [routes, mapReady, animationProgress, enableRouteAnimation, getStepColor]);

  // Memoized meeting zone circle
  const meetingZoneCircle = useMemo(() => {
    if (!meetingPoint?.coordinates || meetingZoneRadius <= 0) return null;

    return (
      <Circle
        key={`meeting-zone-${meetingZoneRadius}-${meetingPoint.coordinates[0]}-${meetingPoint.coordinates[1]}`}
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
  }, [meetingPoint?.coordinates, meetingZoneRadius]);

  // Optimized region change handler with throttling
  const onRegionChangeComplete = useCallback(
    (() => {
      let timeoutId;
      return (newRegion) => {
        if (!onBoundsChange || isAnimating) return;
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
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
        }, 300); // Throttle to 300ms
      };
    })(),
    [onBoundsChange, isAnimating]
  );

  // Platform-specific map props
  const platformProps = useMemo(() => Platform.select({
    ios: { maxZoomLevel: 18, minZoomLevel: 10 },
    android: { maxZoomLevel: 18, minZoomLevel: 10 }
  }), []);

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
        {...platformProps}
      >
        {optimizedMarkers}
        {optimizedRoutes}
        {meetingZoneCircle}
      </MapView>
    </View>
  );
});

// Enhanced memoization with more granular comparisons
const areEqual = (prevProps, nextProps) => {
  // Fast checks for primitive values
  if (prevProps.height !== nextProps.height) return false;
  if (prevProps.animateToResults !== nextProps.animateToResults) return false;
  if (prevProps.venueRadius !== nextProps.venueRadius) return false;
  if (prevProps.enableRouteAnimation !== nextProps.enableRouteAnimation) return false;
  if (prevProps.routeAnimationDuration !== nextProps.routeAnimationDuration) return false;
  if (prevProps.routeAnimationDelay !== nextProps.routeAnimationDelay) return false;
  
  // Center comparison
  if (prevProps.center?.[0] !== nextProps.center?.[0] || 
      prevProps.center?.[1] !== nextProps.center?.[1]) return false;
  
  // Array length comparisons first (fast)
  if (prevProps.markers?.length !== nextProps.markers?.length) return false;
  if (prevProps.routes?.length !== nextProps.routes?.length) return false;
  
  // Meeting point comparison
  if (prevProps.meetingPoint?.coordinates?.[0] !== nextProps.meetingPoint?.coordinates?.[0] ||
      prevProps.meetingPoint?.coordinates?.[1] !== nextProps.meetingPoint?.coordinates?.[1]) return false;
  
  // Deep markers comparison (only if lengths match)
  if (prevProps.markers && nextProps.markers && prevProps.markers.length > 0) {
    for (let i = 0; i < prevProps.markers.length; i++) {
      const prevMarker = prevProps.markers[i];
      const nextMarker = nextProps.markers[i];
      if (prevMarker?.position?.[0] !== nextMarker?.position?.[0] ||
          prevMarker?.position?.[1] !== nextMarker?.position?.[1] ||
          prevMarker?.type !== nextMarker?.type) return false;
    }
  }
  
  // Routes comparison (simplified - only check steps count)
  if (prevProps.routes && nextProps.routes && prevProps.routes.length > 0) {
    for (let i = 0; i < prevProps.routes.length; i++) {
      const prevRoute = prevProps.routes[i];
      const nextRoute = nextProps.routes[i];
      if (prevRoute?.steps?.length !== nextRoute?.steps?.length) return false;
    }
  }
  
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
    shadowOffset: { width: 0, height: 2 },
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

OptimizedMarker.displayName = 'OptimizedMarker';
Route.displayName = 'Route';
MapContainer.displayName = 'OptimizedMapContainer';

export default MapContainer;