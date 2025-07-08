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
import CompactActionsCard from './CompactActionsCard';
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
  mode = 'main', // 'main' or 'group'
  addresses = [] // Addresses used to generate the meeting point (for sharing)
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
          {/* Compact Actions Card with Stats and Buttons */}
          <CompactActionsCard
            meetingPoint={mp}
            travelTimes={mp.travelTimes || mp.travel_times || []}
            onStartNewSearch={null} // Remove new search button from here since it's now in header
            onCreateGroup={mode === 'main' ? onCreateGroup : null}
            addresses={addresses}
            mode={mode}
          />

          {/* Route Details - No container box */}
          <RouteDetailsToggle
            routes={mp.routes || []}
            travelTimes={mp.travelTimes || mp.travel_times || []}
          />

          {/* Venues - No container box */}
          {(mp.venues || []).length > 0 && (
            <VenuesDisplay venues={mp.venues || []} />
          )}

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
          {/* Header with New Search Button and Pagination dots */}
          <View style={styles.headerContainer}>
            {/* New Search Button */}
            {mode === 'main' && onStartNewSearch && (
              <TouchableOpacity
                style={styles.newSearchButton}
                onPress={onStartNewSearch}
              >
                <MaterialIcons name="rotate-left" size={22} color="#8b5cf6" />
                <Text style={styles.newSearchButtonText}>New Search</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.spacer} />
            
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
          {/* Header with New Search Button for single meeting point */}
          {mode === 'main' && onStartNewSearch && (
            <View style={styles.singleHeaderContainer}>
              <TouchableOpacity
                style={styles.newSearchButton}
                onPress={onStartNewSearch}
              >
                <MaterialIcons name="rotate-left" size={22} color="#8b5cf6" />
                <Text style={styles.newSearchButtonText}>New Search</Text>
              </TouchableOpacity>
            </View>
          )}
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  newSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  newSearchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  spacer: {
    width: 16, // Space between button and dots
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb', // Lighter gray for inactive dots
  },
  paginationDotActive: {
    backgroundColor: '#8b5cf6', // More vivid purple instead of blue
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
    marginHorizontal: 16,
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
  singleHeaderContainer: {
    marginBottom: 16,
  },
});

export default MeetingPointResults; 