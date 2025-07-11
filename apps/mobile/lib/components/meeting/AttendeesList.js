import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GradientView } from '../core';
import { GRADIENT_STYLES } from '../../theme/gradients';

/**
 * Individual Attendee Item Component
 * Memoized to prevent re-renders when other attendees change
 */
const AttendeeItem = memo(({ member }) => {
  console.log(`👤 Rendering AttendeeItem for ${member.display_name}`);
  
  return (
    <GradientView 
      key={member.id} 
      gradientName="lightBlue" 
      style={[styles.attendeeItem, GRADIENT_STYLES.card]}
    >
      <View style={styles.attendeeInfo}>
        <GradientView 
          gradientName={member.type === 'custom_location' ? "sunsetOrange" : "blueToMagenta"}
          style={styles.attendeeAvatar}
        >
          <MaterialIcons 
            name={member.type === 'custom_location' ? "place" : "person"} 
            size={16} 
            color="white" 
          />
        </GradientView>
        <View style={styles.attendeeDetails}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {member.display_name || 'Unknown'}
            {member.is_me && ' (You)'}
          </Text>
          {member.type === 'custom_location' && (
            <Text style={styles.attendeeType} numberOfLines={1}>
              Custom Location{member.created_by ? ` • Added by ${member.created_by}` : ''}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.attendanceStatus}>
        <MaterialIcons 
          name={member.attendance?.isAttending ? "check-circle" : "radio-button-unchecked"} 
          size={20} 
          color={member.attendance?.isAttending ? "#10b981" : "#9ca3af"} 
        />
      </View>
    </GradientView>
  );
});

/**
 * Optimized AttendeesList Component
 * Uses React.memo and memoized calculations to prevent unnecessary re-renders
 */
const AttendeesList = memo(({ 
  members, 
  isExpanded, 
  onToggle 
}) => {
  console.log('👥 Rendering AttendeesList');

  // Memoized attendees summary
  const attendeesSummary = useMemo(() => {
    const attending = members.filter(m => m.attendance?.isAttending);
    const total = members.length;
    return { attending: attending.length, total };
  }, [members]);

  // Memoized attendee items
  const attendeeItems = useMemo(() => {
    return members.map((member) => (
      <AttendeeItem key={member.id} member={member} />
    ));
  }, [members]);

  return (
    <GradientView gradientName="lightBlue" style={[styles.attendeesSection, GRADIENT_STYLES.card]}>
      <TouchableOpacity 
        style={styles.attendeesHeader} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.attendeesHeaderLeft}>
          <MaterialIcons name="group" size={20} color="#6b7280" />
          <Text style={styles.attendeesTitle}>
            Attendees ({attendeesSummary.attending}/{attendeesSummary.total})
          </Text>
        </View>
        <MaterialIcons 
          name={isExpanded ? "expand-less" : "expand-more"} 
          size={24} 
          color="#6b7280" 
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.attendeesList}>
          {attendeeItems}
        </View>
      )}
    </GradientView>
  );
});

// Custom comparison function for better memoization
const areEqual = (prevProps, nextProps) => {
  // Compare expansion state
  if (prevProps.isExpanded !== nextProps.isExpanded) {
    return false;
  }

  // Compare members length
  if (prevProps.members?.length !== nextProps.members?.length) {
    return false;
  }

  // Compare attendance status for each member (shallow comparison)
  if (prevProps.members && nextProps.members) {
    for (let i = 0; i < prevProps.members.length; i++) {
      const prevMember = prevProps.members[i];
      const nextMember = nextProps.members[i];
      
      if (prevMember?.id !== nextMember?.id) {
        return false;
      }
      
      if (prevMember?.attendance?.isAttending !== nextMember?.attendance?.isAttending) {
        return false;
      }
    }
  }

  return true;
};

AttendeeItem.displayName = 'AttendeeItem';
AttendeesList.displayName = 'AttendeesList';

const MemoizedAttendeesList = memo(AttendeesList, areEqual);

const styles = StyleSheet.create({
  attendeesSection: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  attendeesHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendeesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  attendeesList: {
    paddingBottom: 8,
  },
  attendeeItem: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendeeDetails: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  attendeeType: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  attendanceStatus: {
    marginLeft: 8,
  },
});

export default MemoizedAttendeesList; 