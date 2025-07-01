import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const TRACK_HEIGHT = 56;
const THUMB_SIZE = 48;
const SMALL_TRACK_HEIGHT = 44;
const SMALL_THUMB_SIZE = 36;

export default function SlideToConfirm({
  text = "Slide to confirm attendance",
  confirmText = "Confirmed!",
  cancelText = "Slide to cancel attendance", 
  onConfirm,
  onCancel,
  isConfirmed = false,
  disabled = false,
  style = {},
  size = "normal",
  label,
  isAttending,
  onAttendanceChange,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [completed, setCompleted] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const velocity = useRef({ x: 0, y: 0 }).current;
  const lastMove = useRef({ x: 0, timestamp: 0 }).current;
  
  // Use size-based constants
  const trackHeight = size === "small" ? SMALL_TRACK_HEIGHT : TRACK_HEIGHT;
  const thumbSize = size === "small" ? SMALL_THUMB_SIZE : THUMB_SIZE;
  
  // Handle new attendance props
  const actualIsConfirmed = isAttending !== undefined ? isAttending : isConfirmed;
  const actualOnConfirm = onAttendanceChange ? () => onAttendanceChange(true) : onConfirm;
  const actualOnCancel = onAttendanceChange ? () => onAttendanceChange(false) : onCancel;
  
  const maxTranslation = Math.max(0, trackWidth - thumbSize - 8); // 4px padding on each side

  // Track velocity for inertia
  const updateVelocity = (gestureState) => {
    const now = Date.now();
    const dt = now - lastMove.timestamp;
    
    if (dt > 0) {
      velocity.x = (gestureState.dx - lastMove.x) / dt * 1000; // pixels per second
    }
    
    lastMove.x = gestureState.dx;
    lastMove.timestamp = now;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !completed,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal gestures
      return !disabled && !completed && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 8;
    },
    
    onPanResponderGrant: (evt, gestureState) => {
      if (disabled || completed) return;
      setIsDragging(true);
      
      // Initialize velocity tracking
      lastMove.x = 0;
      lastMove.timestamp = Date.now();
      velocity.x = 0;
      
      // Stop any ongoing animation
      translateX.stopAnimation();
    },
    
    onPanResponderMove: (evt, gestureState) => {
      if (disabled || completed) return;
      
      // Update velocity for inertia calculation
      updateVelocity(gestureState);
      
      const newValue = Math.max(0, Math.min(gestureState.dx, maxTranslation));
      translateX.setValue(newValue);
      
      // Check if we've reached the threshold for auto-completion
      if (newValue >= maxTranslation * 0.9) {
        handleComplete();
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      if (disabled || completed) return;
      
      setIsDragging(false);
      
      const currentValue = gestureState.dx;
      const clampedValue = Math.max(0, Math.min(currentValue, maxTranslation));
      
      // Calculate where we should end up based on position, velocity, and thresholds
      let targetValue = 0;
      
      // Check completion threshold
      if (clampedValue >= maxTranslation * 0.7) {
        targetValue = maxTranslation;
      } else if (clampedValue >= maxTranslation * 0.3 && velocity.x > 500) {
        // Fast swipe can trigger completion even if not at threshold
        targetValue = maxTranslation;
      } else {
        // Return to start, with inertia
        const inertiaDistance = velocity.x * 0.1; // Reduce inertia factor
        targetValue = Math.max(0, Math.min(clampedValue + inertiaDistance, maxTranslation * 0.6));
        
        // If inertia would put us past the threshold, complete the action
        if (targetValue >= maxTranslation * 0.7) {
          targetValue = maxTranslation;
        } else {
          targetValue = 0; // Otherwise return to start
        }
      }
      
      // Animate to target with appropriate timing
      const distance = Math.abs(targetValue - clampedValue);
      const duration = Math.min(400, Math.max(200, distance * 2));
      
      Animated.timing(translateX, {
        toValue: targetValue,
        duration,
        useNativeDriver: false,
      }).start(() => {
        if (targetValue >= maxTranslation * 0.9) {
          handleComplete();
        }
      });
    },
    
    onPanResponderTerminationRequest: () => false, // Don't allow termination during drag
  });

  const handleComplete = () => {
    if (disabled || completed) return;
    
    setCompleted(true);
    
    // Ensure we're at the end position
    Animated.timing(translateX, {
      toValue: maxTranslation,
      duration: 150,
      useNativeDriver: false,
    }).start(() => {
      // Trigger the appropriate action
      setTimeout(() => {
        if (actualIsConfirmed) {
          actualOnCancel && actualOnCancel();
        } else {
          actualOnConfirm && actualOnConfirm();
        }
        
        // Reset after action
        setTimeout(() => {
          setCompleted(false);
          Animated.timing(translateX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }, 500);
      }, 200);
    });
  };

  const handleTrackLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setTrackWidth(width);
  };

  // Reset position when isConfirmed changes
  useEffect(() => {
    if (!isDragging && !completed) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [actualIsConfirmed]);

  const displayText = label || (actualIsConfirmed ? cancelText : text);
  const currentText = completed ? (actualIsConfirmed ? "Cancelling..." : "Confirming...") : displayText;
  const currentIcon = actualIsConfirmed ? "close" : "chevron-right";
  const trackColor = actualIsConfirmed ? "#fef2f2" : "#f8fafc";
  const fillColor = actualIsConfirmed ? "#fee2e2" : "#e0e7ff";
  const thumbBorderColor = actualIsConfirmed ? "#fecaca" : "#c7d2fe";
  const iconColor = actualIsConfirmed ? "#ef4444" : "#6366f1";
  const textColor = actualIsConfirmed ? "#991b1b" : "#6b7280";

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[styles.track, { 
          backgroundColor: trackColor, 
          height: trackHeight,
          borderRadius: trackHeight / 2
        }]}
        onLayout={handleTrackLayout}
      >
        {/* Animated fill */}
        <Animated.View 
          style={[
            styles.fill,
            { 
              backgroundColor: fillColor,
              width: Animated.add(translateX, thumbSize),
              borderRadius: (trackHeight - 8) / 2
            }
          ]} 
        />
        
        {/* Text */}
        <View style={[styles.textContainer, { paddingLeft: thumbSize + 8 }]}>
          <Animated.Text 
            style={[
              styles.text,
              { 
                color: textColor,
                opacity: (isDragging || completed) ? 0.4 : 1,
                fontSize: size === "small" ? 12 : 14
              }
            ]}
          >
            {currentText}
          </Animated.Text>
        </View>
        
        {/* Slider thumb */}
        <Animated.View
          style={[
            styles.thumb,
            { 
              borderColor: thumbBorderColor,
              transform: [{ translateX }],
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2
            }
          ]}
          {...panResponder.panHandlers}
        >
          <MaterialIcons 
            name={currentIcon} 
            size={size === "small" ? 16 : 20} 
            color={iconColor} 
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    maxWidth: 400, // Prevent it from being too wide on tablets
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
  },
  thumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
}); 