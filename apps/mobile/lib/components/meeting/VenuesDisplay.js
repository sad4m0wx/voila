import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const VenuesDisplay = ({ venues }) => {
  if (!venues || venues.length === 0) return null;

  return (
    <View style={styles.venuesSection}>
      <Text style={styles.venuesTitle}>Nearby Places</Text>
      <View style={styles.venuesGrid}>
        {venues.slice(0, 6).map((venue, index) => (
          <View key={index} style={styles.venueChip}>
            <Text style={styles.venueName} numberOfLines={1}>
              {venue.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  venuesSection: {
    marginTop: 12,
  },
  venuesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  venuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  venueChip: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: (screenWidth - 64) / 2,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  venueName: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '500',
  },
});

export default VenuesDisplay; 