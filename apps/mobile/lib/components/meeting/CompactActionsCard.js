import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createShareLink, shareNatively, copyToClipboard } from '../../services/shareService';
import { GradientView } from '../core';
import { getGradientColors } from '../../theme/gradients';

const CompactActionsCard = ({ 
  meetingPoint, 
  travelTimes = [],
  onStartNewSearch, 
  onCreateGroup, 
  addresses,
  mode = 'main' // 'main' or 'group'
}) => {
  const [isSharing, setIsSharing] = useState(false);

  // Calculate average travel time
  const durations = travelTimes.map(tt => tt.duration || 0);
  const avgDuration = durations.length > 0 
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const handleShareLocation = async () => {
    if (!meetingPoint || !meetingPoint.coordinates) {
      Alert.alert('Error', 'No location to share');
      return;
    }

    try {
      const coords = meetingPoint.coordinates;
      const shareData = {
        title: `Meeting Point: ${meetingPoint.name}`,
        message: `Let's meet at ${meetingPoint.name}\nhttps://maps.google.com/?q=${coords[1]},${coords[0]}`,
      };

      await Share.share(shareData);
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share location');
    }
  };

  const handleShareMeetingPoint = async () => {
    if (!addresses || addresses.length < 2) {
      Alert.alert('Error', 'Cannot share this meeting point - missing location data');
      return;
    }

    setIsSharing(true);

    try {
      const shareResult = await createShareLink(addresses);
      
      if (!shareResult.success) {
        throw new Error(shareResult.error);
      }

      // Share the meeting point
      const coords = meetingPoint.coordinates;
      const shareData = {
        title: `Meeting Point: ${meetingPoint.name}`,
        message: `I found the perfect place for us to meet! Check out this meeting point:\n\n${shareResult.shareUrl}`,
        url: shareResult.shareUrl
      };

      const shared = await shareNatively(shareData);
      if (!shared) {
        // Fallback to copying the link
        const success = await copyToClipboard(shareResult.shareUrl);
        if (success) {
          Alert.alert('Link Copied', 'Meeting point link copied to clipboard');
        }
      }

    } catch (error) {
      console.error('Error creating share link:', error);
      Alert.alert('Error', 'Failed to create share link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenInMaps = () => {
    if (!meetingPoint || !meetingPoint.coordinates) {
      Alert.alert('Error', 'No location to open');
      return;
    }

    const [lng, lat] = meetingPoint.coordinates;
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;

    if (Platform.OS === 'ios') {
      // Try to open in Apple Maps first, fallback to Google Maps
      const appleMapsUrl = `http://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;
      Linking.canOpenURL(appleMapsUrl).then(supported => {
        if (supported) {
          Linking.openURL(appleMapsUrl);
        } else {
          Linking.openURL(mapsUrl);
        }
      });
    } else {
      Linking.openURL(mapsUrl);
    }
  };

  const showNewSearch = mode === 'main' && onStartNewSearch;
  
  const actions = [
    {
      id: 'open-maps',
      icon: 'map',
      label: 'Open Maps',
      onPress: handleOpenInMaps,
      gradientName: 'greenEmerald',
      background: getGradientColors('lightGreen')
    },
    ...(addresses && addresses.length >= 2 ? [{
      id: 'share',
      icon: isSharing ? 'hourglass-empty' : 'share',
      label: isSharing ? 'Sharing...' : 'Share',
      onPress: handleShareMeetingPoint,
      disabled: isSharing,
      gradientName: 'blueToMagenta',
      background: getGradientColors('lightBlue')
    }] : [])
  ];

  const createGroupAction = mode === 'main' && onCreateGroup ? {
    id: 'create-group',
    icon: 'group-add',
    label: 'Create Group',
    onPress: onCreateGroup,
    gradientName: 'sunsetOrange',
    background: getGradientColors('lightPurple')
  } : null;

  return (
    <View style={styles.container}>
      {/* Travel Time Stats - Remove header section since new search button moved */}
      <View style={styles.statsHeader}>
        <View style={styles.statsContent}>
          <Text style={styles.statsValue}>{avgDuration}</Text>
          <Text style={styles.statsUnit}>min</Text>
        </View>
        <Text style={styles.statsLabel}>Average Travel Time</Text>
      </View>

      {/* Action Buttons Grid */}
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <GradientView
            key={action.id}
            colors={action.background}
            style={[
              styles.actionButton,
              action.disabled && styles.actionButtonDisabled
            ]}
          >
            <TouchableOpacity
              style={styles.actionButtonContent}
              onPress={action.onPress}
              disabled={action.disabled}
            >
              <GradientView
                gradientName={action.gradientName}
                style={styles.actionIconContainer}
              >
                <MaterialIcons 
                  name={action.icon} 
                  size={20} 
                  color="white"
                />
              </GradientView>
              <Text style={[styles.actionLabel, { color: getGradientColors(action.gradientName)[0] }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          </GradientView>
        ))}
      </View>

      {/* Create Group Button */}
      {createGroupAction && (
        <GradientView
          key={createGroupAction.id}
          colors={createGroupAction.background}
          style={styles.actionButton}
        >
          <TouchableOpacity
            style={styles.actionButtonContent}
            onPress={createGroupAction.onPress}
            disabled={createGroupAction.disabled}
          >
            <GradientView
              gradientName={createGroupAction.gradientName}
              style={styles.actionIconContainer}
            >
              <MaterialIcons 
                name={createGroupAction.icon} 
                size={20} 
                color="white"
              />
            </GradientView>
            <Text style={[styles.actionLabel, { color: getGradientColors(createGroupAction.gradientName)[0] }]}>
              {createGroupAction.label}
            </Text>
          </TouchableOpacity>
        </GradientView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Remove white background
    borderRadius: 0, // Remove border radius
    padding: 20,
    shadowColor: 'transparent', // Remove shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Remove elevation
    marginBottom: 16,
  },
  spacer: {
    flex: 1,
  },
  statsHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#8b5cf6', // More vivid purple
    letterSpacing: -0.5,
  },
  statsUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: '#a855f7', // More vivid purple for unit
    marginLeft: 4,
  },
  statsLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  actionButton: {
    borderRadius: 16,
    minWidth: '22%',
    flex: 1,
    marginHorizontal: 2,
  },
  actionButtonContent: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default CompactActionsCard; 