import React, { memo } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapContainer from './MapContainer';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';
import { MAP_HEIGHTS } from '../../config';

/**
 * Unified Optimized Map Section Component
 * Handles both main page and group page map displays
 * Uses React.memo to prevent re-renders when props haven't changed
 */
const MapSection = memo(({
  // Map state
  mapHeightAnim,
  mapExpanded,
  meetingPoint,
  
  // Map data
  markers,
  routes,
  center,
  venueRadius,
  animateToResults,
  
  // Event handlers
  onToggleExpanded,
  onBoundsChange,
  onBackPress,
  onSettingsPress,
  
  // UI components
  logoComponent,
  authButtonComponent,
  
  // Mode configuration
  mode = 'main', // 'main' or 'group'
  
  // Optional group-specific props
  currentGroup,
  attendeeAddresses
}) => {
  const renderHeaderControls = () => {
    if (mode === 'main') {
      return (
        <View style={styles.headerControls}>
          {logoComponent}
          <View style={styles.mapControls}>
            {meetingPoint && (
              <TouchableOpacity
                style={styles.mapControlButton}
                onPress={onToggleExpanded}
                activeOpacity={0.7}
              >
                <MaterialIcons 
                  name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                  size={20} 
                  color="#6b7280" 
                />
              </TouchableOpacity>
            )}
            {authButtonComponent}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.headerControls}>
        <View style={styles.leftButtons}>
          <GradientView
            gradientName="lightBlue"
            style={[styles.headerButton, GRADIENT_STYLES.card]}
          >
            <TouchableOpacity
              style={styles.headerButtonContent}
              onPress={onBackPress}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={20} color="#6b7280" />
            </TouchableOpacity>
          </GradientView>
        </View>
        
        <View style={styles.rightButtons}>
          <GradientView
            gradientName="lightBlue"
            style={[styles.headerButton, GRADIENT_STYLES.card]}
          >
            <TouchableOpacity
              style={styles.headerButtonContent}
              onPress={onToggleExpanded}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name={mapExpanded ? "fullscreen-exit" : "fullscreen"} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
          </GradientView>
          {mode === 'group' && (
            <GradientView
              gradientName="lightBlue"
              style={[styles.headerButton, GRADIENT_STYLES.card]}
            >
              <TouchableOpacity
                style={styles.headerButtonContent}
                onPress={onSettingsPress}
                activeOpacity={0.7}
              >
                <MaterialIcons name="settings" size={20} color="#6b7280" />
              </TouchableOpacity>
            </GradientView>
          )}
        </View>
      </View>
    );
  };

  return (
    <Animated.View 
      style={[
        styles.mapArea,
        mode === 'main' && mapHeightAnim ? 
          { height: mapHeightAnim } : 
          { height: mapExpanded ? MAP_HEIGHTS.GROUP_EXPANDED : MAP_HEIGHTS.GROUP_DEFAULT }
      ]}
    >
      {renderHeaderControls()}

      <View style={styles.mapContainer}>
        <MapContainer
          center={center}
          markers={markers}
          routes={routes}
          meetingPoint={meetingPoint}
          venueRadius={venueRadius}
          animateToResults={animateToResults}
          height="100%"
          onBoundsChange={onBoundsChange}
        />
      </View>
    </Animated.View>
  );
});

// Custom comparison function for better memoization
MapSection.displayName = 'MapSection';

const areEqual = (prevProps, nextProps) => {
  // Compare mode first
  if (prevProps.mode !== nextProps.mode) return false;

  // Compare primitive values
  if (
    prevProps.mapExpanded !== nextProps.mapExpanded ||
    prevProps.venueRadius !== nextProps.venueRadius ||
    prevProps.animateToResults !== nextProps.animateToResults
  ) return false;

  // Compare meeting point
  if (prevProps.meetingPoint !== nextProps.meetingPoint) {
    if (prevProps.meetingPoint?.coordinates && nextProps.meetingPoint?.coordinates) {
      const prevCoords = prevProps.meetingPoint.coordinates;
      const nextCoords = nextProps.meetingPoint.coordinates;
      if (prevCoords[0] !== nextCoords[0] || prevCoords[1] !== nextCoords[1]) {
        return false;
      }
    } else if (prevProps.meetingPoint !== nextProps.meetingPoint) {
      return false;
    }
  }

  // Compare center
  if (prevProps.center !== nextProps.center) {
    if (Array.isArray(prevProps.center) && Array.isArray(nextProps.center)) {
      if (prevProps.center[0] !== nextProps.center[0] || prevProps.center[1] !== nextProps.center[1]) {
        return false;
      }
    } else {
      return false;
    }
  }

  // Compare markers length
  if (prevProps.markers?.length !== nextProps.markers?.length) return false;

  // Compare routes length
  if (prevProps.routes?.length !== nextProps.routes?.length) return false;

  // Group-specific comparisons
  if (prevProps.mode === 'group') {
    if (prevProps.currentGroup?.id !== nextProps.currentGroup?.id) return false;
    if (prevProps.attendeeAddresses?.length !== nextProps.attendeeAddresses?.length) return false;
  }

  return true;
};

const styles = {
  mapArea: {
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: '#f3f4f6',
  },
  headerControls: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mapControls: {
    flexDirection: 'row',
    gap: 8,
  },
  mapControlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
  },
  leftButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerButtonContent: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
};

export default memo(MapSection, areEqual); 