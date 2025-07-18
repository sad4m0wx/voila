import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GradientView } from '../core';
import { getGradientColors, getGradientPositions, COMPONENT_GRADIENTS } from '../../theme/gradients';

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
  const isDraggingRef = useRef(false);
  const completedRef = useRef(false);
  
  // Use size-based constants
  const trackHeight = size === "small" ? SMALL_TRACK_HEIGHT : TRACK_HEIGHT;
  const thumbSize = size === "small" ? SMALL_THUMB_SIZE : THUMB_SIZE;
  
  // Handle new attendance props
  const actualIsConfirmed = isAttending !== undefined ? isAttending : isConfirmed;
  const actualOnConfirm = useCallback(() => {
    if (onAttendanceChange) {
      onAttendanceChange(true);
    } else if (onConfirm) {
      onConfirm();
    }
  }, [onAttendanceChange, onConfirm]);
  
  const actualOnCancel = useCallback(() => {
    if (onAttendanceChange) {
      onAttendanceChange(false);
    } else if (onCancel) {
      onCancel();
    }
  }, [onAttendanceChange, onCancel]);
  
  const maxTranslation = Math.max(0, trackWidth - thumbSize - 8); // 4px padding on each side

  // Memoize expensive calculations
  const { trackColors, fillColors, trackPositions, fillPositions, thumbBorderColor, textColor } = useMemo(() => {
    const trackGradientName = actualIsConfirmed ? COMPONENT_GRADIENTS.attendingTrack : COMPONENT_GRADIENTS.notAttendingTrack;
    const fillGradientName = actualIsConfirmed ? COMPONENT_GRADIENTS.attendingFill : COMPONENT_GRADIENTS.notAttendingFill;
    
    return {
      trackColors: getGradientColors(trackGradientName),
      fillColors: getGradientColors(fillGradientName),
      trackPositions: getGradientPositions(trackGradientName),
      fillPositions: getGradientPositions(fillGradientName),
      thumbBorderColor: actualIsConfirmed ? "#22c55e" : "#ef4444",
      textColor: actualIsConfirmed ? "#166534" : "#991b1b"
    };
  }, [actualIsConfirmed]);

  // Memoize text and icon
  const { currentText, currentIcon } = useMemo(() => {
    const displayText = label || (actualIsConfirmed ? confirmText : cancelText);
    return {
      currentText: completed ? (actualIsConfirmed ? "Cancelling..." : "Confirming...") : displayText,
      currentIcon: actualIsConfirmed ? "check" : "close"
    };
  }, [label, actualIsConfirmed, confirmText, cancelText, completed]);

  // Initialize position based on current state
  useEffect(() => {
    if (trackWidth > 0 && !isDraggingRef.current && !completedRef.current) {
      const targetPosition = actualIsConfirmed ? maxTranslation : 0;
      Animated.timing(translateX, {
        toValue: targetPosition,
        duration: 200,
        useNativeDriver: true, // Enable native driver for better performance
      }).start();
    }
  }, [actualIsConfirmed, trackWidth, maxTranslation]);

  // Update refs when state changes
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // Optimized velocity tracking with throttling
  const updateVelocity = useCallback((gestureState) => {
    const now = Date.now();
    const dt = now - lastMove.timestamp;
    
    if (dt > 0 && dt < 50) { // More responsive velocity calculation
      velocity.x = (gestureState.dx - lastMove.x) / dt * 1000; // pixels per second
    }
    
    lastMove.x = gestureState.dx;
    lastMove.timestamp = now;
  }, []);

  // Memoized completion handler
  const handleComplete = useCallback(() => {
    if (disabled || completedRef.current) return;
    
    setCompleted(true);
    
    // Determine target position and action
    const targetPosition = actualIsConfirmed ? 0 : maxTranslation;
    
    // Ensure we're at the target position
    Animated.timing(translateX, {
      toValue: targetPosition,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Trigger the appropriate action
      setTimeout(() => {
        if (actualIsConfirmed) {
          actualOnCancel();
        } else {
          actualOnConfirm();
        }
        
        // Reset completed state
        setTimeout(() => {
          setCompleted(false);
        }, 200);
      }, 200);
    });
  }, [disabled, actualIsConfirmed, maxTranslation, actualOnCancel, actualOnConfirm]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !completedRef.current,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal gestures with optimized threshold
      return !disabled && !completedRef.current && 
             Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
             Math.abs(gestureState.dx) > 8;
    },
    
    onPanResponderGrant: (evt, gestureState) => {
      if (disabled || completedRef.current) return;
      setIsDragging(true);
      
      // Initialize velocity tracking
      lastMove.x = 0;
      lastMove.timestamp = Date.now();
      velocity.x = 0;
      
      // Stop any ongoing animation
      translateX.stopAnimation();
    },
    
    onPanResponderMove: (evt, gestureState) => {
      if (disabled || completedRef.current) return;
      
      // Update velocity for inertia calculation (optimized)
      if (Math.abs(gestureState.dx - lastMove.x) > 1) {
        updateVelocity(gestureState);
      }
      
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
      if (disabled || completedRef.current) return;
      
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
        useNativeDriver: true,
      }).start(() => {
        if (targetValue !== startPosition) {
          handleComplete();
        }
      });
    },
    
    onPanResponderTerminationRequest: () => false, // Don't allow termination during drag
  }), [disabled, actualIsConfirmed, maxTranslation, updateVelocity, handleComplete]);

  const handleTrackLayout = useCallback((event) => {
    const { width } = event.nativeEvent.layout;
    setTrackWidth(width);
  }, []);

  // Memoized animated scale for fill (native driver compatible)
  const animatedFillScale = useMemo(() => {
    return translateX.interpolate({
      inputRange: [0, maxTranslation],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }, [translateX, maxTranslation]);

  // Memoized animated opacity for text
  const textOpacity = useMemo(() => {
    return (isDragging || completed) ? 0.4 : 1;
  }, [isDragging, completed]);

  return (
    <View style={[styles.container, style]}>
      <GradientView 
        colors={trackColors}
        start={trackPositions.start}
        end={trackPositions.end}
        style={[styles.track, { 
          height: trackHeight,
          borderRadius: trackHeight / 2
        }]}
        onLayout={handleTrackLayout}
      >
        {/* Animated gradient fill */}
        <View style={[styles.fillContainer, { borderRadius: (trackHeight - 8) / 2, overflow: 'hidden' }]}>
          <Animated.View 
            style={[
              styles.fill,
              { 
                width: maxTranslation + thumbSize,
                transform: [{ scaleX: animatedFillScale }],
              }
            ]} 
          >
            <GradientView
              colors={fillColors}
              start={fillPositions.start}
              end={fillPositions.end}
              style={styles.fillGradient}
            />
          </Animated.View>
        </View>
        
        {/* Text */}
        <View style={[styles.textContainer, { paddingLeft: thumbSize + 8 }]}>
          <Animated.Text 
            style={[
              styles.text,
              { 
                color: textColor,
                opacity: textOpacity,
                fontSize: size === "small" ? 12 : 14
              }
            ]}
          >
            {currentText}
          </Animated.Text>
        </View>
        
        {/* Slider thumb with gradient background */}
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
          <GradientView
            gradientName={actualIsConfirmed ? 'greenEmerald' : 'crimsonRed'}
            style={[styles.thumbGradient, {
              width: thumbSize - 4,
              height: thumbSize - 4,
              borderRadius: (thumbSize - 4) / 2
            }]}
          >
            <MaterialIcons 
              name={currentIcon} 
              size={size === "small" ? 16 : 20} 
              color="white" 
            />
          </GradientView>
        </Animated.View>
      </GradientView>
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
    left: 0,
    top: 0,
    bottom: 0,
  },
  fillGradient: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    right: 4,
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
  thumbGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillContainer: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
  },
}); 