import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getGradientColors, getGradientPositions, GRADIENTS } from '../../theme/gradients';

const GradientView = ({ 
  gradientName, 
  children, 
  style, 
  colors, 
  start, 
  end,
  ...props 
}) => {
  // Allow override with direct props or use predefined gradient
  const gradientColors = colors || getGradientColors(gradientName);
  const gradientPositions = (start && end) ? { start, end } : getGradientPositions(gradientName);

  return (
    <LinearGradient
      colors={gradientColors}
      start={gradientPositions.start}
      end={gradientPositions.end}
      style={style}
      {...props}
    >
      {children}
    </LinearGradient>
  );
};

export default GradientView; 