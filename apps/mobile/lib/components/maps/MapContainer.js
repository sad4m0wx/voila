import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

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
    style = {}
  } = props;

  console.log(`🗺️ MapContainer received props:`, {
    markersLength: Array.isArray(markers) ? markers.length : 'not array',
    routesLength: Array.isArray(routes) ? routes.length : 'not array',
  });

  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Initial region based on center prop
  const initialRegion = useMemo(() => ({
    latitude: center[1],
    longitude: center[0],
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }), [center[0], center[1]]);

  // Handle map ready event
  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  // Calculate meeting zone radius (blue circle around meeting point)
  const meetingZoneRadius = useMemo(() => {
    return meetingPoint && venueRadius > 0 ? venueRadius : 0;
  }, [meetingPoint, venueRadius]);

  // Auto-fit map to show all markers and routes when data changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || markers.length === 0) return;

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
        }
      }, 500);
    }
  }, [markers, mapReady]);

  // Animate to meeting point when results are available
  useEffect(() => {
    if (!mapRef.current || !mapReady || !animateToResults || !meetingPoint?.coordinates) return;

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
      }
    }, 500);
  }, [animateToResults, meetingPoint, meetingZoneRadius, mapReady]);

  // Get marker color based on type and index
  const getMarkerColor = useCallback((type, index = 0) => {
    const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];
    
    switch (type) {
      case 'meeting-point':
        return '#EF4444';
      case 'venue':
        return '#F59E0B';
      case 'location':
      default:
        return colors[index % colors.length];
    }
  }, []);

  // Get marker icon based on type
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

  // Render individual marker
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

  // Helper function to get step color
  const getStepColor = useCallback((step, routeColor) => {
    // Walking steps are green
    if (step.mode === 'walking') {
      return '#059669'; // Darker emerald
    }
    
    // Transit steps use the line color if available
    if (step.mode === 'transit' && step.transit_details?.line?.color) {
      // Ensure the color has a # prefix
      const lineColor = step.transit_details.line.color;
      const finalColor = lineColor.startsWith('#') ? lineColor : `#${lineColor}`;
      return finalColor;
    }
    
    // Driving steps are blue
    if (step.mode === 'driving') {
      return '#2563EB'; // Darker blue
    }
    
    // Default to route color or indigo
    const defaultColor = routeColor || '#6366f1';
    return defaultColor;
  }, []);

  // Render route with steps
  const renderRoute = useCallback((route, routeIndex) => {
    if (!route) return null;

    const polylines = [];
    
    // If route has steps, render each step separately with its own color
    if (route.steps && Array.isArray(route.steps) && route.steps.length > 0) {
      
      route.steps.forEach((step, stepIndex) => {
        if (!step.geometry || !step.geometry.coordinates || !Array.isArray(step.geometry.coordinates)) {
          return;
        }

        const stepCoords = step.geometry.coordinates;
        if (stepCoords.length < 2) {
          return;
        }

        // Convert coordinates to React Native Maps format
        const coordinates = stepCoords
          .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
          .map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
          }));

        if (coordinates.length < 2) {
          return;
        }

        // Get color for this step
        const stepColor = getStepColor(step, route.color);
        console.log(`🎨 Route ${routeIndex}, Step ${stepIndex} (${step.mode}): Color ${stepColor}`);

        // Simple, stable key generation
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
      });
    } else if (route.geometry && route.geometry.coordinates) {
      // Fallback: render entire route as single polyline
      console.log(`🎯 Route ${routeIndex}: Using main geometry, color: ${route.color}`);
      
      const coordinates = route.geometry.coordinates
        .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
        .map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));

      if (coordinates.length >= 2) {
        const uniqueKey = `route-main-${routeIndex}`;
        
        polylines.push(
          <Polyline
            key={uniqueKey}
            coordinates={coordinates}
            strokeColor={route.color || '#6366f1'}
            strokeWidth={6}
            geodesic={true}
            tappable={false}
          />
        );
      }
    }

    return polylines;
  }, [getStepColor]);

  // Render meeting zone circle
  const renderMeetingZoneCircle = useCallback(() => {
    if (!meetingPoint || !meetingPoint.coordinates || meetingZoneRadius <= 0) return null;

    return (
      <Circle
        key={`meeting-zone-${meetingZoneRadius}`}
        center={{
          latitude: meetingPoint.coordinates[1],
          longitude: meetingPoint.coordinates[0],
        }}
        radius={meetingZoneRadius}
        strokeColor="rgba(59, 130, 246, 0.5)"
        fillColor="rgba(59, 130, 246, 0.15)"
        strokeWidth={2}
      />
    );
  }, [meetingPoint, meetingZoneRadius]);

  // Handle region change and notify parent
  const onRegionChangeComplete = useCallback((newRegion) => {
    if (onBoundsChange && typeof onBoundsChange === 'function') {
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
    }
  }, [onBoundsChange]);

  return (
    <View style={[{ height }, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#6366f1"
        loadingBackgroundColor="#f3f4f6"
      >
        {/* Render all markers */}
        {mapReady && markers.map((marker, index) => renderMarker(marker, index))}

        {/* Render all routes (now returns arrays of polylines) */}
        {mapReady && routes.map((route, index) => renderRoute(route, index))}

        {/* Render meeting zone circle */}
        {mapReady && renderMeetingZoneCircle()}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
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

export default MapContainer;