import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, StatusBar, Dimensions, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import RouteDetails from './RouteDetails';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RouteDetailsToggle = ({ routes, travelTimes }) => {
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  if (!routes || routes.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.routeToggle} 
        onPress={() => setShowRouteDetails(true)}
      >
        <View style={styles.routeToggleLeft}>
          <MaterialIcons name="directions" size={20} color="#3b82f6" />
          <Text style={styles.routeToggleText}>
            Route Details 
          </Text>
        </View>
        <MaterialIcons 
          name="expand-less"
          size={24} 
          color="#3b82f6" 
        />
      </TouchableOpacity>

      <Modal
        visible={showRouteDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRouteDetails(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRouteDetails(false)}
          />
          <View style={styles.modalContent}>
            <SafeAreaView style={styles.modalContentInner}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Route Details</Text>
                <TouchableOpacity 
                  onPress={() => setShowRouteDetails(false)}
                  style={styles.closeButton}
                >
                  <MaterialIcons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.routeDetailsContainer}
                contentContainerStyle={styles.routeDetailsContent}
                showsVerticalScrollIndicator={false}
              >
                <RouteDetails 
                  routes={routes} 
                  travelTimes={travelTimes} 
                />
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  routeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    height: SCREEN_HEIGHT * 0.7, // Takes up 70% of screen height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalContentInner: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },

  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 8,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  routeDetailsContainer: {
    flex: 1,
  },
  routeDetailsContent: {
    padding: 16,
  },
});

export default RouteDetailsToggle; 