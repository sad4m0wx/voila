import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';

const MapContainer = ({
  center = [2.3522, 48.8566], // [longitude, latitude]
  zoom = 12,
  markers = [],
  routes = [],
  meetingZoneRadius = 0,
  animateToResults = false,
  zoomToFitMarkers = true,
  height = '100%',
  onBoundsChange,
  style = {}
}) => {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Convert [lng, lat] to {latitude, longitude} format for react-native-maps
  const centerCoord = {
    latitude: center[1],
    longitude: center[0],
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  const handleMapReady = () => {
    setMapReady(true);
  };

  useEffect(() => {
    if (animateToResults && markers.length > 0 && mapRef.current && mapReady) {
      // Fit map to show all markers
      setTimeout(() => {
        if (mapRef.current) {
          const coordinates = markers.map(marker => ({
            latitude: marker.position[1],
            longitude: marker.position[0],
          }));

          if (coordinates.length > 1) {
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          } else if (coordinates.length === 1) {
            mapRef.current.animateToRegion({
              ...coordinates[0],
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }
        }
      }, 500); // Increased timeout
    }
  }, [animateToResults, markers, mapReady]);

  const getMarkerColor = (type) => {
    switch (type) {
      case 'meeting-point':
        return '#ef4444'; // Red
      case 'venue':
        return '#f59e0b'; // Orange
      default:
        return '#6366f1'; // Blue
    }
  };

  const getMarkerIcon = (type) => {
    switch (type) {
      case 'meeting-point':
        return 'flag';
      case 'venue':
        return 'restaurant';
      default:
        return 'place';
    }
  };

  const renderMarker = (marker, index) => {
    const coordinate = {
      latitude: marker.position[1],
      longitude: marker.position[0],
    };

    return (
      <Marker
        key={`marker-${index}`}
        coordinate={coordinate}
        title={marker.title}
        description={marker.info}
      >
        <View style={[styles.customMarker, { backgroundColor: getMarkerColor(marker.type) }]}>
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
  };

  const renderRoute = (route, index) => {

    if (!route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length < 2) {
      return null;
    }

    // Convert coordinates to react-native-maps format
    const coordinates = route.geometry.coordinates
      .filter(coord => 
        Array.isArray(coord) && 
        coord.length >= 2 && 
        typeof coord[0] === 'number' && 
        typeof coord[1] === 'number' &&
        Math.abs(coord[0]) <= 180 && 
        Math.abs(coord[1]) <= 90
      )
      .map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

    // Skip routes with too few valid coordinates
    if (coordinates.length < 2) {
      return null;
    }

    // Determine line style based on mode
    const strokeWidth = route.weight || (route.mode === 'walking' ? 3 : 5);
    const strokeColor = route.color || '#6366f1';

    return (
      <Polyline
        key={`route-${index}-${route.id || ''}-${strokeColor}`}
        coordinates={coordinates}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={route.opacity || 0.8}
      />
    );
  };

  const onRegionChangeComplete = (region) => {
    if (onBoundsChange) {
      // Calculate bounds from region
      const bounds = {
        northeast: [
          region.longitude + region.longitudeDelta / 2,
          region.latitude + region.latitudeDelta / 2
        ],
        southwest: [
          region.longitude - region.longitudeDelta / 2,
          region.latitude - region.latitudeDelta / 2
        ]
      };
      onBoundsChange({ bounds });
    }
  };

  return (
    <View style={[{ height }, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={centerCoord}
        onMapReady={handleMapReady}
        showsUserLocation={true}
        showsCompass={true}
        showsScale={true}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType="standard"
      >
        {/* Render markers */}
        {markers.map((marker, index) => renderMarker(marker, index))}

        {/* Render routes */}
        {routes.map((route, index) => renderRoute(route, index))}

        {/* Render meeting zone radius */}
        {meetingZoneRadius > 0 && markers.length > 0 && (
          markers
            .filter(marker => marker.type === 'meeting-point')
            .map((marker, index) => (
              <Circle
                key={`circle-${index}`}
                center={{
                  latitude: marker.position[1],
                  longitude: marker.position[0],
                }}
                radius={meetingZoneRadius}
                strokeColor="rgba(99, 102, 241, 0.3)"
                fillColor="rgba(99, 102, 241, 0.1)"
                strokeWidth={2}
              />
            ))
        )}
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
    top: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  markerNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
});

export default MapContainer;