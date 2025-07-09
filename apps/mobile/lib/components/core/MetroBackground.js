import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MetroBackground = () => {
  const animatedValue1 = useRef(new Animated.Value(0)).current;
  const animatedValue2 = useRef(new Animated.Value(0)).current;
  const animatedValue3 = useRef(new Animated.Value(0)).current;
  const animatedValue4 = useRef(new Animated.Value(0)).current;
  const animatedValue5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Multiple animation loops for different speeds
    Animated.loop(
      Animated.timing(animatedValue1, {
        toValue: 1,
        duration: 28000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(animatedValue2, {
        toValue: 1,
        duration: 32000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(animatedValue3, {
        toValue: 1,
        duration: 25000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(animatedValue4, {
        toValue: 1,
        duration: 30000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(animatedValue5, {
        toValue: 1,
        duration: 35000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        viewBox="0 0 1400 900"
        preserveAspectRatio="xMidYMid slice"
        style={styles.svg}
      >
        <Defs>
          {/* Vibrant Gradient Definitions */}
          <LinearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <Stop offset="30%" stopColor="#3B82F6" stopOpacity="0.8" />
            <Stop offset="70%" stopColor="#6366F1" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#10B981" stopOpacity="0" />
            <Stop offset="30%" stopColor="#10B981" stopOpacity="0.7" />
            <Stop offset="70%" stopColor="#059669" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
            <Stop offset="50%" stopColor="#F59E0B" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#D97706" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient4" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <Stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient5" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#EF4444" stopOpacity="0" />
            <Stop offset="50%" stopColor="#EF4444" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient6" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
            <Stop offset="50%" stopColor="#06B6D4" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient7" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#84CC16" stopOpacity="0" />
            <Stop offset="50%" stopColor="#84CC16" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#65A30D" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient8" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F97316" stopOpacity="0" />
            <Stop offset="50%" stopColor="#F97316" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient9" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#EC4899" stopOpacity="0" />
            <Stop offset="50%" stopColor="#EC4899" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#DB2777" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Primary Metro Trails */}
        <Path
          d="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
          stroke="url(#gradient1)"
          strokeWidth="3"
          fill="none"
          opacity="0.8"
        />
        
        <Path
          d="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
          stroke="url(#gradient2)"
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
        
        <Path
          d="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
          stroke="url(#gradient3)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.6"
        />
        
        <Path
          d="M200,-100 Q180,100 220,300 Q260,500 240,700 Q220,800 200,1000"
          stroke="url(#gradient4)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.5"
        />
        
        <Path
          d="M1200,-100 Q1180,150 1220,350 Q1160,550 1200,750 Q1240,850 1200,1000"
          stroke="url(#gradient5)"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />
        
        <Path
          d="M-100,500 Q150,420 400,480 Q650,540 900,500 Q1150,460 1400,520 Q1600,580 1700,540"
          stroke="url(#gradient6)"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />
        
        <Path
          d="M-100,400 Q200,380 500,420 Q800,460 1100,440 Q1300,420 1500,460 Q1600,480 1700,460"
          stroke="url(#gradient7)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />

        <Path
          d="M-100,80 Q400,40 800,100 Q1200,160 1600,120"
          stroke="url(#gradient8)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />

        <Path
          d="M1600,820 Q1200,780 800,840 Q400,900 -100,860"
          stroke="url(#gradient9)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />

        {/* Animated Moving Dots */}
        <G>
          <AnimatedCircle
            r="5"
            fill="#3B82F6"
            opacity="0.9"
            animatedValue={animatedValue1}
            path="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
          />
          <AnimatedCircle
            r="4"
            fill="#10B981"
            opacity="0.8"
            animatedValue={animatedValue2}
            path="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
          />
          <AnimatedCircle
            r="4"
            fill="#F59E0B"
            opacity="0.7"
            animatedValue={animatedValue3}
            path="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
          />
          <AnimatedCircle
            r="3"
            fill="#8B5CF6"
            opacity="0.6"
            animatedValue={animatedValue4}
            path="M200,-100 Q180,100 220,300 Q260,500 240,700 Q220,800 200,1000"
          />
          <AnimatedCircle
            r="3"
            fill="#EF4444"
            opacity="0.6"
            animatedValue={animatedValue5}
            path="M1200,-100 Q1180,150 1220,350 Q1160,550 1200,750 Q1240,850 1200,1000"
          />
        </G>

        {/* Floating Particles */}
        <G opacity="0.2">
          <Circle cx="300" cy="250" r="1" fill="#3B82F6" opacity="0.5" />
          <Circle cx="800" cy="150" r="1.5" fill="#10B981" opacity="0.4" />
          <Circle cx="1100" cy="600" r="1" fill="#F59E0B" opacity="0.6" />
          <Circle cx="400" cy="700" r="1.5" fill="#8B5CF6" opacity="0.3" />
          <Circle cx="600" cy="450" r="1" fill="#EF4444" opacity="0.5" />
          <Circle cx="950" cy="350" r="1.5" fill="#06B6D4" opacity="0.4" />
          <Circle cx="250" cy="550" r="1" fill="#84CC16" opacity="0.5" />
          <Circle cx="1250" cy="250" r="1.5" fill="#EC4899" opacity="0.4" />
        </G>
      </Svg>
    </View>
  );
};

// Custom animated circle component
const AnimatedCircle = ({ r, fill, opacity, animatedValue, path }) => {
  // This is a simplified version - in production, you'd use react-native-svg-animations
  // or implement path following animation
  return <Circle cx="0" cy="0" r={r} fill={fill} opacity={opacity} />;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.2,
  },
  svg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default MetroBackground;