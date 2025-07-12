import React, { memo } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapContainer from './MapContainer';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';

/**
 * Unified Optimized Map Section Component
 * Handles both main page and group page map displays
 * Uses React.memo to prevent re-renders when props haven't changed
 */
const MapSection = memo(({
  // Map state
  mapHeightAnim,
  meetingPoint,
  
  // Map data
  markers,
  routes,
  center,
  venueRadius,
  animateToResults,
  
  // Event handlers
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
          { height: 320 }
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
  try {
    // Compare mode first
    if (prevProps.mode !== nextProps.mode) return false;

    // Compare primitive values
    if (
      prevProps.venueRadius !== nextProps.venueRadius ||
      prevProps.animateToResults !== nextProps.animateToResults
    ) return false;

    // Compare meeting point with more thorough checks
    if (prevProps.meetingPoint !== nextProps.meetingPoint) {
      // If either is null/undefined but the other isn't
      if (!prevProps.meetingPoint || !nextProps.meetingPoint) return false;
      
      // Compare coordinates
      if (prevProps.meetingPoint?.coordinates && nextProps.meetingPoint?.coordinates) {
        const prevCoords = prevProps.meetingPoint.coordinates;
        const nextCoords = nextProps.meetingPoint.coordinates;
        if (!Array.isArray(prevCoords) || !Array.isArray(nextCoords)) return false;
        if (prevCoords.length !== nextCoords.length) return false;
        if (prevCoords[0] !== nextCoords[0] || prevCoords[1] !== nextCoords[1]) return false;
      } else {
        return false;
      }
      
      // Compare name for debugging
      if (prevProps.meetingPoint?.name !== nextProps.meetingPoint?.name) {
        console.log('MapSection: Meeting point name changed', {
          prev: prevProps.meetingPoint?.name,
          next: nextProps.meetingPoint?.name
        });
        return false;
      }
    }

    // Compare center with better validation
    if (prevProps.center !== nextProps.center) {
      if (!Array.isArray(prevProps.center) || !Array.isArray(nextProps.center)) return false;
      if (prevProps.center.length !== nextProps.center.length) return false;
      if (prevProps.center[0] !== nextProps.center[0] || prevProps.center[1] !== nextProps.center[1]) return false;
    }

    // Compare markers with more thorough checks
    if (prevProps.markers?.length !== nextProps.markers?.length) {
      console.log('MapSection: Markers length changed', {
        prev: prevProps.markers?.length,
        next: nextProps.markers?.length
      });
      return false;
    }

    // Compare routes with more thorough checks
    if (prevProps.routes?.length !== nextProps.routes?.length) {
      console.log('MapSection: Routes length changed', {
        prev: prevProps.routes?.length,
        next: nextProps.routes?.length
      });
      return false;
    }

    // Check if routes content changed (not just reference)
    if (prevProps.routes && nextProps.routes && prevProps.routes.length > 0 && nextProps.routes.length > 0) {
      // Simple check - if the first route has a different geometry, consider it changed
      const prevFirstRoute = prevProps.routes[0];
      const nextFirstRoute = nextProps.routes[0];
      
      if (prevFirstRoute?.geometry?.coordinates?.length !== nextFirstRoute?.geometry?.coordinates?.length) {
        console.log('MapSection: Route geometry changed');
        return false;
      }
    }

    // Group-specific comparisons
    if (prevProps.mode === 'group') {
      if (prevProps.currentGroup?.id !== nextProps.currentGroup?.id) return false;
      if (prevProps.attendeeAddresses?.length !== nextProps.attendeeAddresses?.length) return false;
    }

    return true;
  } catch (error) {
    console.error('Error in MapSection comparison:', error);
    return false; // Re-render on error to be safe
  }
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