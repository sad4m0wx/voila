import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import StatsDisplay from './StatsDisplay';
import ActionButtons from './ActionButtons';
import RouteDetailsToggle from './RouteDetailsToggle';
import VenuesDisplay from './VenuesDisplay';

const { width: screenWidth } = Dimensions.get('window');

const MeetingPointResults = ({
  meetingPoint,
  meetingPoints = [],
  currentMeetingPointIndex = 0,
  setCurrentMeetingPointIndex,
  onStartNewSearch,
  onCreateGroup,
  mode = 'main' // 'main' or 'group'
}) => {
  const flatListRef = useRef(null);

  if (!meetingPoint) return null;

  // Determine if we have multiple meeting points
  const allMeetingPoints = meetingPoints.length > 0 ? meetingPoints : [meetingPoint];
  const hasMultiple = allMeetingPoints.length > 1;
  const currentMP = allMeetingPoints[currentMeetingPointIndex] || meetingPoint;

  // Get travel times - handle both formats
  const travelTimes = currentMP.travelTimes || currentMP.travel_times || [];
  const routes = currentMP.routes || [];
  const venues = currentMP.venues || [];

  const renderMeetingPoint = ({ item, index }) => {
    const mp = allMeetingPoints[index];
    
    return (
      <View style={styles.meetingPointSlide}>
        <View style={styles.meetingPointContent}>          
          {/* Statistics */}
          <StatsDisplay travelTimes={mp.travelTimes || mp.travel_times || []} />

          {/* Action Buttons */}
          <ActionButtons
            meetingPoint={mp}
            onStartNewSearch={mode === 'main' ? onStartNewSearch : null}
            onCreateGroup={mode === 'main' ? onCreateGroup : null}
          />

          {/* Route Details */}
          <RouteDetailsToggle
            routes={mp.routes || []}
            travelTimes={mp.travelTimes || mp.travel_times || []}
          />

          {/* Venues */}
          <VenuesDisplay venues={mp.venues || []} />

          {/* Fallback notice */}
          {mp.name === "Geographic Center" && (
            <View style={styles.fallbackNotice}>
              <MaterialIcons name="info" size={16} color="#f59e0b" />
              <Text style={styles.fallbackText}>Estimated location</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {hasMultiple ? (
        <View style={styles.swipeableContainer}>
          {/* Pagination dots */}
          <View style={styles.paginationContainer}>
            {allMeetingPoints.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentMeetingPointIndex && styles.paginationDotActive
                ]}
              />
            ))}
          </View>

          <FlatList
            ref={flatListRef}
            data={allMeetingPoints}
            renderItem={renderMeetingPoint}
            keyExtractor={(item, index) => `meeting-point-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentMeetingPointIndex}
            getItemLayout={(data, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              if (!hasMultiple || !setCurrentMeetingPointIndex) return;
              
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              // Ensure index stays within bounds
              const boundedIndex = Math.max(0, Math.min(index, allMeetingPoints.length - 1));
              setCurrentMeetingPointIndex(boundedIndex);
            }}
            style={styles.meetingPointsList}
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={screenWidth}
            contentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>
      ) : (
        // Single meeting point
        <View style={styles.singleContainer}>
          {renderMeetingPoint({ item: currentMP, index: 0 })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  swipeableContainer: {
    marginBottom: 16,
  },
  singleContainer: {
    paddingHorizontal: 16,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  paginationDotActive: {
    backgroundColor: '#6366f1',
    width: 24,
  },
  meetingPointsList: {
    marginHorizontal: 0,
  },
  meetingPointSlide: {
    width: screenWidth,
    paddingHorizontal: 0,
  },
  meetingPointContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  locationName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    gap: 6,
  },
  fallbackText: {
    fontSize: 12,
    color: '#d97706',
    fontStyle: 'italic',
  },
});

export default MeetingPointResults; 