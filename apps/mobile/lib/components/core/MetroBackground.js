import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const MetroBackground = () => {
  // Create animated values for moving dots along paths
  const dot1Progress = useRef(new Animated.Value(0)).current;
  const dot2Progress = useRef(new Animated.Value(0)).current;
  const dot3Progress = useRef(new Animated.Value(0)).current;
  const dot4Progress = useRef(new Animated.Value(0)).current;
  const dot5Progress = useRef(new Animated.Value(0)).current;
  const dot6Progress = useRef(new Animated.Value(0)).current;
  const dot7Progress = useRef(new Animated.Value(0)).current;
  const dot8Progress = useRef(new Animated.Value(0)).current;
  const dot9Progress = useRef(new Animated.Value(0)).current;
  
  // Floating particles for extra depth
  const particle1Y = useRef(new Animated.Value(0)).current;
  const particle2Y = useRef(new Animated.Value(0)).current;
  const particle3Y = useRef(new Animated.Value(0)).current;
  const particle4Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate dots along curved paths - continuous smooth movement
    const animateDot = (animValue, duration, delay = 0) => {
      const animate = () => {
        Animated.loop(
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          })
        ).start();
      };
      setTimeout(animate, delay);
    };

    // Start dot animations with staggered timing (like SvelteKit version)
    animateDot(dot1Progress, 28000, 0);      // 28s like SvelteKit
    animateDot(dot2Progress, 32000, 5000);   // 32s with 5s delay
    animateDot(dot3Progress, 35000, 10000);  // 35s with 10s delay
    animateDot(dot4Progress, 38000, 3000);   // 38s with 3s delay
    animateDot(dot5Progress, 42000, 8000);   // 42s with 8s delay
    animateDot(dot6Progress, 45000, 12000);  // 45s with 12s delay
    animateDot(dot7Progress, 48000, 6000);   // 48s with 6s delay
    animateDot(dot8Progress, 52000, 15000);  // 52s with 15s delay
    animateDot(dot9Progress, 55000, 18000);  // 55s with 18s delay

    // Floating particles animation (gentle bob)
    const animateParticles = (particle, duration) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(particle, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(particle, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateParticles(particle1Y, 4000);
    animateParticles(particle2Y, 6000);
    animateParticles(particle3Y, 5000);
    animateParticles(particle4Y, 7000);

  }, []);

  // Scale SVG to fit device dimensions
  const viewBoxWidth = 1400;
  const viewBoxHeight = 900;

  return (
    <View style={styles.container}>
      <Svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid slice"
        style={styles.svg}
      >
        <Defs>
          {/* Enhanced Gradients with More Sophisticated Colors */}
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

        {/* Primary Metro Trails - Exact same paths as SvelteKit */}
        {/* Metro Trail 1 - Main horizontal with curve */}
        <Path
          d="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
          stroke="url(#gradient1)"
          strokeWidth="3"
          fill="none"
          opacity="0.8"
        />
        
        {/* Metro Trail 2 - Bottom flowing curve */}
        <Path
          d="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
          stroke="url(#gradient2)"
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
        
        {/* Metro Trail 3 - Reverse top elegant curve */}
        <Path
          d="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
          stroke="url(#gradient3)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.6"
        />
        
        {/* Metro Trail 4 - Vertical left flowing */}
        <Path
          d="M200,-100 Q180,100 220,300 Q260,500 240,700 Q220,800 200,1000"
          stroke="url(#gradient4)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.5"
        />
        
        {/* Metro Trail 5 - Vertical right organic */}
        <Path
          d="M1200,-100 Q1180,150 1220,350 Q1160,550 1200,750 Q1240,850 1200,1000"
          stroke="url(#gradient5)"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />
        
        {/* Metro Trail 6 - Diagonal sweep */}
        <Path
          d="M-100,500 Q150,420 400,480 Q650,540 900,500 Q1150,460 1400,520 Q1600,580 1700,540"
          stroke="url(#gradient6)"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />
        
        {/* Metro Trail 7 - Middle gentle wave */}
        <Path
          d="M-100,400 Q200,380 500,420 Q800,460 1100,440 Q1300,420 1500,460 Q1600,480 1700,460"
          stroke="url(#gradient7)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />

        {/* Metro Trail 8 - Top accent */}
        <Path
          d="M-100,80 Q400,40 800,100 Q1200,160 1600,120"
          stroke="url(#gradient8)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />

        {/* Metro Trail 9 - Bottom accent */}
        <Path
          d="M1600,820 Q1200,780 800,840 Q400,900 -100,860"
          stroke="url(#gradient9)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />

        {/* Floating Particles for Extra Depth */}
        <G opacity="0.2">
          <Circle cx="300" cy="250" r="1" fill="#3B82F6" opacity="0.5" />
          <Circle cx="800" cy="150" r="1.5" fill="#10B981" opacity="0.4" />
          <Circle cx="1100" cy="600" r="1" fill="#F59E0B" opacity="0.6" />
          <Circle cx="400" cy="700" r="1.5" fill="#8B5CF6" opacity="0.3" />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 0.2, // Same opacity as SvelteKit version
    pointerEvents: 'none',
  },
  svg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default MetroBackground; 