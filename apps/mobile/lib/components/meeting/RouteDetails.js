import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

const RouteDetails = ({ routes = [], travelTimes = [] }) => {

  const processedRoutes = useMemo(() => {
    if (!Array.isArray(routes) || routes.length === 0) {
      return [];
    }

    // Simple 1:1 pairing: each route corresponds to one travel time
    // This matches the web version approach
    return routes.map((route, index) => {
      const travelTime = Array.isArray(travelTimes) && travelTimes[index] ? travelTimes[index] : null;
      
      // Get steps from the route
      const steps = Array.isArray(route?.steps) ? route.steps : [];

      return {
        id: route.id || `route-${index}`,
        travelTime,
        steps: steps.filter(step => step && step.mode) // Filter out invalid steps
      };
    }).filter(route => route.steps.length > 0); // Only include routes with valid steps
  }, [routes, travelTimes]);

  // Helper function to get vehicle icon
  const getVehicleIcon = (vehicleType, mode) => {
    if (mode === 'walking' || mode === 'walk') {
      return <MaterialIcons name="directions-walk" size={12} color="#334155" />;
    }
    
    if (mode === 'transit') {
      const iconMap = {
        'subway': 'subway',
        'metro': 'subway', 
        'bus': 'directions-bus',
        'tram': 'tram',
        'train': 'train',
        'rail': 'train'
      };
      const iconName = iconMap[vehicleType?.toLowerCase()] || 'directions-transit';
      return <MaterialIcons name={iconName} size={12} color="#334155" />;
    }
    
    return <MaterialIcons name="directions" size={12} color="#334155" />;
  };
  
  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0 min';
    const minutes = Math.ceil(seconds / 60);
    return minutes === 1 ? '1 min' : `${minutes} mins`;
  };
  
  // Helper function to get mode color
  const getModeColor = (mode, vehicleType) => {
    if (mode === 'walking') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' };
    if (mode === 'transit') {
      const colorMap = {
        'subway': { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' },
        'metro': { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' },
        'bus': { backgroundColor: '#fed7aa', color: '#c2410c', borderColor: '#fdba74' },
        'tram': { backgroundColor: '#e9d5ff', color: '#7c2d12', borderColor: '#d8b4fe' },
        'train': { backgroundColor: '#fecaca', color: '#b91c1c', borderColor: '#fca5a5' },
        'rail': { backgroundColor: '#fecaca', color: '#b91c1c', borderColor: '#fca5a5' }
      };
      return colorMap[vehicleType?.toLowerCase()] || { backgroundColor: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' };
    }
    return { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' };
  };
  
  if (processedRoutes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No route information available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {processedRoutes.map((route, routeIndex) => (
        <View key={route.id} style={styles.routeContainer}>
          {/* Route Header */}
          <View style={styles.routeHeader}>
            <View style={styles.routeHeaderLeft}>
              <View style={styles.routeNumber}>
                <Text style={styles.routeNumberText}>{routeIndex + 1}</Text>
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeAddress} numberOfLines={1}>
                  {route.travelTime?.address || `Route ${routeIndex + 1}`}
                </Text>
              </View>
            </View>
            <View style={styles.routeHeaderRight}>
              <Text style={styles.routeDuration}>
                {route.travelTime?.duration || 0} min
              </Text>
              {route.travelTime?.estimated && (
                <Text style={styles.estimatedLabel}>estimated</Text>
              )}
            </View>
          </View>
          
          {/* Route Steps */}
          <View style={styles.stepsContainer}>
            {route.steps.map((step, stepIndex) => {
              const modeColors = getModeColor(step.mode, step.transit_details?.line?.vehicle_type);
              
              return (
                <View key={`step-${stepIndex}`} style={styles.stepContainer}>
                  {/* Step Icon */}
                  <View style={[styles.stepIcon, modeColors]}>
                    {getVehicleIcon(step.transit_details?.line?.vehicle_type, step.mode)}
                  </View>
                  
                  {/* Step Details */}
                  <View style={styles.stepDetails}>
                    <View style={styles.stepHeader}>
                      {step.mode === 'transit' && step.transit_details ? (
                        <View style={styles.transitInfo}>
                          <Text style={styles.transitLine}>
                            {step.transit_details.line?.short_name || step.transit_details.line?.name || 'Transit'}
                          </Text>
                          <View style={styles.vehicleTypeBadge}>
                            <Text style={styles.vehicleTypeText}>
                              {step.transit_details.line?.vehicle_type || 'transit'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.stepMode}>
                          {step.mode.charAt(0).toUpperCase() + step.mode.slice(1)}
                        </Text>
                      )}
                      <Text style={styles.stepDuration}>
                        {formatDuration(step.duration)}
                      </Text>
                    </View>
                    
                    {step.mode === 'transit' && step.transit_details && (
                      <View style={styles.transitDetails}>
                        {step.transit_details.departure_stop && step.transit_details.arrival_stop && (
                          <>
                            <View style={styles.stopInfo}>
                              <View style={styles.stopDot} />
                              <Text style={styles.stopLabel}>From:</Text>
                              <Text style={styles.stopName} numberOfLines={1}>
                                {step.transit_details.departure_stop}
                              </Text>
                            </View>
                            <View style={styles.stopInfo}>
                              <View style={[styles.stopDot, styles.stopDotRed]} />
                              <Text style={styles.stopLabel}>To:</Text>
                              <Text style={styles.stopName} numberOfLines={1}>
                                {step.transit_details.arrival_stop}
                              </Text>
                            </View>
                          </>
                        )}
                        {step.transit_details.num_stops > 0 && (
                          <Text style={styles.stopsCount}>
                            <Text style={styles.stopsCountNumber}>{step.transit_details.num_stops}</Text> stops
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {/* Connector line (except for last step) */}
                  {stepIndex < route.steps.length - 1 && (
                    <View style={styles.stepConnector} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  routeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    overflow: 'hidden',
  },
  routeHeader: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1', // Indigo
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  routeNumberText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  routeInfo: {
    flex: 1,
  },
  routeAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155', // Slate
  },
  routeHeaderRight: {
    alignItems: 'flex-end',
  },
  routeDuration: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6366f1', // Indigo
  },
  estimatedLabel: {
    fontSize: 9,
    color: '#64748b', // Slate
  },
  stepsContainer: {
    padding: 12,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepDetails: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  transitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transitLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155', // Slate
    marginRight: 8,
  },
  vehicleTypeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  vehicleTypeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b', // Slate
  },
  stepMode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155', // Slate
  },
  stepDuration: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b', // Slate
  },
  transitDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.05)',
  },
  stopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  stopDotRed: {
    backgroundColor: '#f87171', // Softer red
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569', // Slate
    marginRight: 6,
    minWidth: 28,
  },
  stopName: {
    fontSize: 10,
    color: '#64748b', // Slate
    flex: 1,
  },
  stopsCount: {
    fontSize: 10,
    color: '#64748b', // Slate
  },
  stopsCountNumber: {
    fontWeight: '600',
  },
  stepConnector: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    marginLeft: 14,
    marginVertical: -6,
  },
});

export default RouteDetails; 