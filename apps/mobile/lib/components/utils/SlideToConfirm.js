import React, { useState, useRef, useEffect } from 'react';
import {
  View,
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
  confirmText = "Attending",
  cancelText = "Not Attending", 
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

  // Initialize position based on current state
  useEffect(() => {
    if (trackWidth > 0 && !isDragging && !completed) {
      const targetPosition = actualIsConfirmed ? maxTranslation : 0;
      Animated.timing(translateX, {
        toValue: targetPosition,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [actualIsConfirmed, trackWidth, maxTranslation, isDragging, completed]);

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
      
      // Calculate new position based on current state and gesture
      const startPosition = actualIsConfirmed ? maxTranslation : 0;
      const newValue = Math.max(0, Math.min(startPosition + gestureState.dx, maxTranslation));
      translateX.setValue(newValue);
      
      // Check if we've reached the threshold for auto-completion
      const threshold = maxTranslation * 0.9;
      if ((actualIsConfirmed && newValue <= maxTranslation * 0.1) || 
          (!actualIsConfirmed && newValue >= threshold)) {
        handleComplete();
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      if (disabled || completed) return;
      
      setIsDragging(false);
      
      const startPosition = actualIsConfirmed ? maxTranslation : 0;
      const currentValue = startPosition + gestureState.dx;
      const clampedValue = Math.max(0, Math.min(currentValue, maxTranslation));
      
      // Calculate where we should end up based on position, velocity, and thresholds
      let targetValue = startPosition; // Default to current state position
      
      // Check completion threshold
      const midPoint = maxTranslation * 0.5;
      
      if (actualIsConfirmed) {
        // Currently attending - check if sliding left to cancel
        if (clampedValue <= maxTranslation * 0.3 || 
            (clampedValue <= midPoint && velocity.x < -500)) {
          targetValue = 0; // Cancel attendance
        } else {
          targetValue = maxTranslation; // Stay attending
        }
      } else {
        // Currently not attending - check if sliding right to confirm
        if (clampedValue >= maxTranslation * 0.7 || 
            (clampedValue >= midPoint && velocity.x > 500)) {
          targetValue = maxTranslation; // Confirm attendance
        } else {
          targetValue = 0; // Stay not attending
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
        if (targetValue !== startPosition) {
          handleComplete();
        }
      });
    },
    
    onPanResponderTerminationRequest: () => false, // Don't allow termination during drag
  });

  const handleComplete = () => {
    if (disabled || completed) return;
    
    setCompleted(true);
    
    // Determine target position and action
    const targetPosition = actualIsConfirmed ? 0 : maxTranslation;
    
    // Ensure we're at the target position
    Animated.timing(translateX, {
      toValue: targetPosition,
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
        
        // Reset completed state
        setTimeout(() => {
          setCompleted(false);
        }, 200);
      }, 200);
    });
  };

  const handleTrackLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setTrackWidth(width);
  };

  // Display current state instead of action
  const displayText = label || (actualIsConfirmed ? confirmText : cancelText);
  const currentText = completed ? (actualIsConfirmed ? "Cancelling..." : "Confirming...") : displayText;
  const currentIcon = actualIsConfirmed ? "check" : "close";
  const trackColor = actualIsConfirmed ? "#f0f9ff" : "#fef2f2";
  const fillColor = actualIsConfirmed ? "#dbeafe" : "#fee2e2";
  const thumbBorderColor = actualIsConfirmed ? "#93c5fd" : "#fecaca";
  const iconColor = actualIsConfirmed ? "#2563eb" : "#ef4444";
  const textColor = actualIsConfirmed ? "#1e40af" : "#991b1b";

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
    maxWidth: 300, 
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