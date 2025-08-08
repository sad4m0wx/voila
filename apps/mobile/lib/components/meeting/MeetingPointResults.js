import React from 'react';
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
  mode = 'main',
  addresses = []
}) => {
  if (!meetingPoint) return null;

  const allMeetingPoints = meetingPoints.length > 0 ? meetingPoints : [meetingPoint];
  const hasMultiple = allMeetingPoints.length > 1;
  const currentMP = allMeetingPoints[currentMeetingPointIndex] || meetingPoint;

  const renderMeetingPoint = ({ item }) => {
    if (!item) return null;

    return (
      <View style={styles.meetingPointSlide}>
        <View style={styles.meetingPointContent}>
          <CompactActionsCard
            meetingPoint={item}
            travelTimes={item.travelTimes || item.travel_times || []}
            onCreateGroup={mode === 'main' ? onCreateGroup : null}
            addresses={addresses}
            mode={mode}
          />

          <RouteDetailsToggle
            routes={item.routes || []}
            travelTimes={item.travelTimes || item.travel_times || []}
          />

          {(item.venues || []).length > 0 && (
            <VenuesDisplay venues={item.venues || []} />
          )}

          {item.name === "Geographic Center" && (
            <View style={styles.fallbackNotice}>
              <MaterialIcons name="info" size={16} color="#f59e0b" />
              <Text style={styles.fallbackText}>Estimated location</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const NewSearchButton = () => (
    mode === 'main' && onStartNewSearch ? (
      <TouchableOpacity
        style={styles.newSearchButton}
        onPress={onStartNewSearch}
      >
        <MaterialIcons name="rotate-left" size={22} color="#8b5cf6" />
        <Text style={styles.newSearchButtonText}>New Search</Text>
      </TouchableOpacity>
    ) : null
  );

  if (!hasMultiple) {
    return (
      <View style={styles.container}>
        <View style={styles.singleContainer}>
          <View style={styles.singleHeaderContainer}>
            <NewSearchButton />
          </View>
          {renderMeetingPoint({ item: currentMP })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.swipeableContainer}>
        <View style={styles.headerContainer}>
          <NewSearchButton />
          <View style={styles.spacer} />
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
          data={allMeetingPoints}
          renderItem={renderMeetingPoint}
          keyExtractor={(_, index) => `meeting-point-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentMeetingPointIndex}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            if (index !== currentMeetingPointIndex) {
              setCurrentMeetingPointIndex(index);
            }
          }}
          style={styles.meetingPointsList}
          snapToAlignment="start"
          decelerationRate="fast"
          snapToInterval={screenWidth}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  swipeableContainer: {
    marginBottom: 8,
  },
  singleContainer: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  newSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  newSearchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  spacer: {
    width: 16,
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
    backgroundColor: '#e5e7eb',
  },
  paginationDotActive: {
    backgroundColor: '#8b5cf6',
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
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  fallbackText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
  },
  singleHeaderContainer: {
    marginBottom: 16,
  },
});

export default MeetingPointResults; 