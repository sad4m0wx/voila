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

  const handleShareMeetingPoint = async () => {
    if (!addresses || addresses.length < 2) {
      Alert.alert('Error', 'Cannot share this meeting point - missing location data');
      return;
    }

    // Map addresses to the expected format for sharing
    const shareAddresses = addresses.map((addr, i) => ({
      id: addr.id?.toString() || `addr-${i}`,
      value: addr.value || addr.address || '',
      coordinates: addr.coordinates || (addr.lng !== undefined && addr.lat !== undefined ? [addr.lng, addr.lat] : undefined)
    }));

    setIsSharing(true);

    try {
      const shareResult = await createShareLink(shareAddresses);
      
      if (!shareResult.success) {
        throw new Error(shareResult.error);
      }

      // Share the meeting point
      const shareData = {
        title: `Meeting Point: ${meetingPoint.name}`,
        message: `I found the perfect place for us to meet! Check out this meeting point: `,
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

    const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;
    const appleMapsUrl = `http://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}&z=16`;
    const citymapperUrl = `citymapper://directions?endcoord=${lat},${lng}`;

    const showOptions = async () => {
      let options = [];
      let urls = [];

      options.push('Citymapper');
      urls.push(citymapperUrl);

      // Apple Maps (iOS only)
      if (Platform.OS === 'ios') {
        options.push('Apple Maps');
        urls.push(appleMapsUrl);
      }

      // Google Maps (always show, opens app if installed, browser otherwise)
      options.push('Google Maps');
      urls.push(googleMapsUrl);

      options.push('Cancel');
      urls.push(null);

      if (Platform.OS === 'ios' && typeof ActionSheetIOS !== 'undefined') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: options.length - 1,
          },
          (buttonIndex) => {
            if (buttonIndex === options.length - 1) return; // Cancel
            const url = urls[buttonIndex];
            if (!url) return;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', `Cannot open ${options[buttonIndex]}`);
            });
          }
        );
      } else {
        // Android or fallback
        Alert.alert(
          'Open in Maps',
          'Choose an app to open the location:',
          options
            .slice(0, -1)
            .map((label, idx) => ({
              text: label,
              onPress: () => {
                const url = urls[idx];
                Linking.openURL(url).catch(() => {
                  Alert.alert('Error', `Cannot open ${label}`);
                });
              }
            }))
            .concat({ text: 'Cancel', style: 'cancel' })
        );
      }
    };

    showOptions();
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

      {/* Create Group Button - Separate Row */}
      {createGroupAction && (
        <View style={styles.createGroupContainer}>
          <GradientView
            colors={createGroupAction.background}
            style={styles.createGroupButton}
          >
            <TouchableOpacity
              style={styles.createGroupButtonContent}
              onPress={createGroupAction.onPress}
              disabled={createGroupAction.disabled}
            >
              <GradientView
                gradientName={createGroupAction.gradientName}
                style={styles.createGroupIconContainer}
              >
                <MaterialIcons 
                  name={createGroupAction.icon} 
                  size={20} 
                  color="white"
                />
              </GradientView>
              <Text style={[styles.createGroupLabel, { color: getGradientColors(createGroupAction.gradientName)[0] }]}>
                {createGroupAction.label}
              </Text>
            </TouchableOpacity>
          </GradientView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Remove white background
    borderRadius: 0, // Remove border radius
    padding: 16,
    shadowColor: 'transparent', // Remove shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Remove elevation
    marginBottom: 12,
  },
  spacer: {
    flex: 1,
  },
  statsHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#8b5cf6', // More vivid purple
    letterSpacing: -0.5,
  },
  statsUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a855f7', // More vivid purple for unit
    marginLeft: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  createGroupContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  createGroupButton: {
    borderRadius: 16,
    minWidth: '80%', // Make it wider
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createGroupIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default CompactActionsCard; 