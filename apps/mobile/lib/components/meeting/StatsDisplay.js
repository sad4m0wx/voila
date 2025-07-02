import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatsDisplay = ({ travelTimes }) => {
  if (!travelTimes || travelTimes.length === 0) return null;

  const durations = travelTimes.map(tt => tt.duration || 0);
  const distances = travelTimes.map(tt => tt.distance || 0);

  const stats = {
    avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    maxDuration: Math.max(...durations),
    totalDistance: distances.reduce((a, b) => a + b, 0),
    attendeeCount: durations.length
  };

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.avgDuration} min</Text>
        <Text style={styles.statLabel}>Avg Travel</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.maxDuration} min</Text>
        <Text style={styles.statLabel}>Max Travel</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },
});

export default StatsDisplay; 