import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { defaultMapCenter, defaultMapZoom } from '../../config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MapContainer = ({
  center = defaultMapCenter,
  zoom = defaultMapZoom,
  markers = [],
  routes = [],
  polygons = [], // For future debug features
  meetingZoneRadius = 0,
  height = 400,
  width = '100%',
  animateToResults = false,
  zoomToFitMarkers = false,
  heatmapData = null, // For future heatmap features
  showHeatmap = false,
  showMovementVectors = false,
  onBoundsChange,
  onReady,
  onError
}) => {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Debug log for routes
  useEffect(() => {
    console.log('MapContainer routes received:', routes);
    if (routes && routes.length > 0) {
      routes.forEach((route, index) => {
        console.log(`Route ${index}:`, {
          id: route.id,
          hasGeometry: !!route.geometry,
          hasCoordinates: !!(route.geometry && route.geometry.coordinates),
          coordinatesLength: route.geometry && route.geometry.coordinates ? route.geometry.coordinates.length : 0,
          color: route.color
        });
      });
    }
  }, [routes]);

  // Convert zoom level to latitudeDelta (approximate)
  const zoomToLatitudeDelta = (zoom) => {
    return 360 / Math.pow(2, zoom);
  };

  // Convert coordinates from [lng, lat] to {latitude, longitude}
  const convertCoordinates = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      return null;
    }
    return {
      latitude: coords[1],
      longitude: coords[0]
    };
  };

  // Create markers for the map
  const createMapMarkers = () => {
    return markers.map((marker, index) => {
      const coordinate = convertCoordinates(marker.position);
      if (!coordinate) return null;

      let pinColor = '#6366f1'; // Default indigo
      let title = marker.title || `Location ${index + 1}`;
      
      // Set colors based on marker type
      if (marker.type === 'meeting-point') {
        pinColor = '#10b981'; // Green for meeting point
      } else if (marker.type === 'venue') {
        pinColor = '#f59e0b'; // Orange for venues
      } else if (marker.type === 'location') {
        // Use different colors for different location numbers
        const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']; // Indigo, Purple, Cyan, Green, Orange
        pinColor = colors[(marker.number - 1) % colors.length];
      }

      return (
        <Marker
          key={`marker-${marker.type}-${index}-${marker.position?.join(',')}`}
          coordinate={coordinate}
          title={title}
          description={marker.info ? marker.info.replace(/<[^>]*>/g, '') : undefined}
          pinColor={pinColor}
          anchor={{ x: 0.5, y: 1 }}
        />
      );
    }).filter(Boolean);
  };

  // Create polylines for routes
  const createRoutePolylines = () => {
    console.log('Creating polylines for routes:', routes?.length || 0);
    
    if (!routes || routes.length === 0) {
      console.log('No routes to display');
      return [];
    }

    return routes.map((route, index) => {
      console.log(`Processing route ${index}:`, route);
      
      if (!route || !route.geometry || !route.geometry.coordinates) {
        console.log(`Route ${index} missing geometry or coordinates`);
        return null;
      }

      const coordinates = route.geometry.coordinates.map(coord => {
        if (!Array.isArray(coord) || coord.length < 2) {
          console.log('Invalid coordinate:', coord);
          return null;
        }
        return {
          latitude: coord[1],
          longitude: coord[0]
        };
      }).filter(Boolean);

      if (coordinates.length < 2) {
        console.log(`Route ${index} has insufficient valid coordinates:`, coordinates.length);
        return null;
      }

      // Use the exact color from the API, or fallback to our scheme if not provided
      const strokeColor = route.color || getRouteColor(index);
      const strokeWidth = route.weight || 4;

      console.log(`Creating polyline for route ${index} with ${coordinates.length} coordinates, using color: ${strokeColor}`);

      return (
        <Polyline
          key={`route-${route.id || index}`}
          coordinates={coordinates}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      );
    }).filter(Boolean);
  };

  // Fallback color function for routes without API colors
  const getRouteColor = (index) => {
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
    return colors[index % colors.length];
  };

  // Create meeting zone circle
  const createMeetingZoneCircle = () => {
    if (meetingZoneRadius <= 0) return null;
    
    const centerCoord = convertCoordinates(center);
    if (!centerCoord) return null;

    return (
      <Circle
        key="meeting-zone"
        center={centerCoord}
        radius={meetingZoneRadius}
        fillColor="rgba(99, 102, 241, 0.1)" // Indigo
        strokeColor="rgba(99, 102, 241, 0.8)" // Indigo
        strokeWidth={2}
      />
    );
  };

  // Fit map to show all markers and routes
  const fitToMarkersAndRoutes = () => {
    if (!mapRef.current || !mapReady) return;

    const coordinates = [];

    // Add marker coordinates
    markers.forEach(marker => {
      const coord = convertCoordinates(marker.position);
      if (coord) coordinates.push(coord);
    });

    // Add route coordinates
    routes.forEach(route => {
      if (route && route.geometry && route.geometry.coordinates) {
        route.geometry.coordinates.forEach(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            coordinates.push({
              latitude: coord[1],
              longitude: coord[0]
            });
          }
        });
      }
    });

    if (coordinates.length > 1) {
      console.log(`Fitting map to ${coordinates.length} coordinates`);
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  // Animate to meeting point
  const animateToMeetingPoint = () => {
    if (!mapRef.current || !mapReady || !center) return;

    const centerCoord = convertCoordinates(center);
    if (!centerCoord) return;

    // Calculate appropriate zoom based on meeting zone radius
    let targetZoom = 15;
    if (meetingZoneRadius > 1000) targetZoom = 13;
    else if (meetingZoneRadius > 500) targetZoom = 14;
    else if (meetingZoneRadius <= 200) targetZoom = 16;

    const region = {
      ...centerCoord,
      latitudeDelta: zoomToLatitudeDelta(targetZoom),
      longitudeDelta: zoomToLatitudeDelta(targetZoom) * (screenWidth / screenHeight),
    };

    mapRef.current.animateToRegion(region, 1000);
  };

  // Handle map ready
  const handleMapReady = () => {
    setMapReady(true);
    onReady && onReady({ map: mapRef.current });
  };

  // Handle region change
  const handleRegionChangeComplete = (region) => {
    if (onBoundsChange) {
      // Calculate bounds from region
      const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
      const northEast = [longitude + longitudeDelta / 2, latitude + latitudeDelta / 2];
      const southWest = [longitude - longitudeDelta / 2, latitude - latitudeDelta / 2];
      
      onBoundsChange({
        bounds: {
          northeast: northEast,
          southwest: southWest
        }
      });
    }
  };

  // Effects
  useEffect(() => {
    if (animateToResults && mapReady && !userInteracted) {
      setTimeout(() => {
        fitToMarkersAndRoutes();
      }, 500); // Delay to ensure all components are rendered
    }
  }, [animateToResults, mapReady, markers, routes]);

  useEffect(() => {
    if (zoomToFitMarkers && mapReady && !animateToResults) {
      fitToMarkersAndRoutes();
    }
  }, [markers, routes, mapReady, zoomToFitMarkers, animateToResults]);

  // Auto-update map when markers or routes change
  useEffect(() => {
    if (mapReady && (markers.length > 0 || routes.length > 0)) {
      // Small delay to ensure all components are rendered
      const timeoutId = setTimeout(() => {
        fitToMarkersAndRoutes();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [markers, routes, mapReady]);

  // Initial region
  const initialRegion = {
    latitude: center[1] || defaultMapCenter[1],
    longitude: center[0] || defaultMapCenter[0],
    latitudeDelta: zoomToLatitudeDelta(zoom),
    longitudeDelta: zoomToLatitudeDelta(zoom) * (screenWidth / screenHeight),
  };

  const polylines = createRoutePolylines();
  console.log(`Rendering ${polylines.length} polylines`);

  return (
    <View style={[styles.container, { height, width }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPanDrag={() => setUserInteracted(true)}
        onUserLocationChange={() => setUserInteracted(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {/* Render markers */}
        {createMapMarkers()}
        
        {/* Render routes */}
        {polylines}
        
        {/* Render meeting zone circle */}
        {createMeetingZoneCircle()}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapContainer; 