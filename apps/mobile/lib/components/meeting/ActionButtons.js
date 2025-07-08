import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createShareLink, shareNatively, copyToClipboard } from '../../services/shareService';

const ActionButtons = ({ meetingPoint, onStartNewSearch, onCreateGroup, addresses }) => {
  const [isSharing, setIsSharing] = useState(false);

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

      // Show sharing options
      Alert.alert(
        'Share Meeting Point',
        'How would you like to share this meeting point?',
        [
          {
            text: 'Copy Link',
            onPress: async () => {
              const success = await copyToClipboard(shareResult.shareUrl);
              if (success) {
                Alert.alert('Success', 'Link copied to clipboard!');
              } else {
                Alert.alert('Error', 'Failed to copy link');
              }
            }
          },
          {
            text: 'Share',
            onPress: async () => {
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
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );

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

  return (
    <View style={styles.container}>
      
            {onStartNewSearch && (
              <TouchableOpacity style={styles.primaryButton} onPress={onStartNewSearch}>
                <Text style={styles.primaryButtonText}>New Search</Text>
              </TouchableOpacity>
            )}
      {/* Primary Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleOpenInMaps}>
          <MaterialIcons name="map" size={18} color="#6366f1" />
          <Text style={styles.actionButtonText}>Open in Maps</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleShareLocation}>
          <MaterialIcons name="share" size={18} color="#6366f1" />
          <Text style={styles.actionButtonText}>Share Location</Text>
        </TouchableOpacity>
      </View>

      {/* Share Meeting Point (if available) */}
      {addresses && addresses.length >= 2 && (
        <TouchableOpacity 
          style={[styles.shareButton, isSharing && styles.shareButtonLoading]} 
          onPress={handleShareMeetingPoint}
          disabled={isSharing}
        >
          <MaterialIcons 
            name={isSharing ? "hourglass-empty" : "link"} 
            size={18} 
            color="white" 
          />
          <Text style={styles.shareButtonText}>
            {isSharing ? 'Creating Link...' : 'Share Meeting Point'}
          </Text>
        </TouchableOpacity>
      )}

      {onCreateGroup && (
        <TouchableOpacity style={styles.groupButton} onPress={onCreateGroup}>
          <MaterialIcons name="group-add" size={18} color="white" />
          <Text style={styles.groupButtonText}>Create Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  groupButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  groupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButtonLoading: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ActionButtons; 