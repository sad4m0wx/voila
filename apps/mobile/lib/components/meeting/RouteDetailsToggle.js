import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import RouteDetails from './RouteDetails';

const RouteDetailsToggle = ({ routes, travelTimes }) => {
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  if (!routes || routes.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.routeToggle} 
        onPress={() => setShowRouteDetails(!showRouteDetails)}
      >
        <View style={styles.routeToggleLeft}>
          <MaterialIcons name="directions" size={20} color="#6366f1" />
          <Text style={styles.routeToggleText}>
            Route Details 
          </Text>
        </View>
        <MaterialIcons 
          name={showRouteDetails ? "expand-less" : "expand-more"} 
          size={24} 
          color="#6366f1" 
        />
      </TouchableOpacity>

      {showRouteDetails && (
        <View style={styles.routeDetailsContainer}>
          <RouteDetails 
            routes={routes} 
            travelTimes={travelTimes} 
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  routeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  routeDetailsContainer: {
    marginTop: 8,
  },
});

export default RouteDetailsToggle; 