import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { shareContent } from '../../services/shareService';
import { GradientView } from '../core';
import { GRADIENT_STYLES, getGradientColors, getGradientPositions } from '../../theme/gradients';

export default function ActionButtons({ 
  meetingPoint, 
  onNewSearch,
  onAddToGroup,
  isGroupMode = false,
  disabled = false 
}) {
  const [isSharing, setIsSharing] = useState(false);

  const handleDirections = () => {
    if (!meetingPoint?.coordinates) {
      Alert.alert('Error', 'No coordinates available for directions');
      return;
    }

    const [lng, lat] = meetingPoint.coordinates;
    const url = `https://maps.google.com/maps?daddr=${lat},${lng}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const handleShare = async () => {
    if (!meetingPoint) return;
    
    setIsSharing(true);
    try {
      const shareText = `Check out this meeting point: ${meetingPoint.name || 'Location'}`;
      const shareUrl = meetingPoint.coordinates 
        ? `https://maps.google.com/maps?q=${meetingPoint.coordinates[1]},${meetingPoint.coordinates[0]}`
        : null;

      await shareContent({
        title: 'Meeting Point',
        message: shareText,
        url: shareUrl
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Could not share meeting point');
    } finally {
      setIsSharing(false);
    }
  };

  const handleBookTable = () => {
    Alert.alert(
      'Book Table',
      'This feature will connect to restaurant booking services.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Action buttons row */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleDirections}
          disabled={disabled}
        >
          <MaterialIcons name="directions" size={18} color="#3b82f6" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleBookTable}
          disabled={disabled}
        >
          <MaterialIcons name="restaurant" size={18} color="#059669" />
          <Text style={styles.actionButtonText}>Book Table</Text>
        </TouchableOpacity>
      </View>

      {/* Primary action buttons with gradients */}
      <GradientView
        gradientName="blueToMagenta"
        style={[styles.primaryButton, GRADIENT_STYLES.primaryButton]}
      >
        <TouchableOpacity 
          style={styles.primaryButtonContent}
          onPress={onNewSearch}
          disabled={disabled}
        >
          <MaterialIcons name="search" size={16} color="white" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>New Search</Text>
        </TouchableOpacity>
      </GradientView>

      {!isGroupMode && (
        <GradientView
          gradientName="greenEmerald"
          style={[styles.groupButton, GRADIENT_STYLES.confirmButton]}
        >
          <TouchableOpacity 
            style={styles.groupButtonContent}
            onPress={onAddToGroup}
            disabled={disabled}
          >
            <MaterialIcons name="group-add" size={16} color="white" />
            <Text style={styles.groupButtonText}>Add to Group</Text>
          </TouchableOpacity>
        </GradientView>
      )}

      <GradientView
        gradientName="purpleToViolet"
        style={[styles.shareButton, GRADIENT_STYLES.secondaryButton, isSharing && styles.shareButtonLoading]}
      >
        <TouchableOpacity 
          style={styles.shareButtonContent}
          onPress={handleShare}
          disabled={disabled || isSharing}
        >
          <MaterialIcons name="share" size={16} color="white" />
          <Text style={styles.shareButtonText}>
            {isSharing ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </GradientView>
    </View>
  );
}

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
    color: '#4f46e5',
  },
  primaryButton: {
    borderRadius: 12,
    marginBottom: 8,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  buttonIcon: {
    marginRight: 4,
  },
  groupButton: {
    borderRadius: 12,
    marginBottom: 8,
  },
  groupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  groupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  shareButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
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