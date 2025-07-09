import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MetroBackground = () => {
  // Create animated values for more dots
  const [animatedValues] = useState(() => ({
    value1: new Animated.Value(0),
    value2: new Animated.Value(0),
    value3: new Animated.Value(0),
    value4: new Animated.Value(0),
    value5: new Animated.Value(0),
    value6: new Animated.Value(0),
    value7: new Animated.Value(0),
    value8: new Animated.Value(0),
    value9: new Animated.Value(0),
    value10: new Animated.Value(0),
    value11: new Animated.Value(0),
    value12: new Animated.Value(0),
    value13: new Animated.Value(0),
    value14: new Animated.Value(0),
    value15: new Animated.Value(0),
    value16: new Animated.Value(0),
    value17: new Animated.Value(0),
    value18: new Animated.Value(0),
    value19: new Animated.Value(0),
    value20: new Animated.Value(0),
  }));

  useEffect(() => {
    // Slower, more staggered animations ensuring always something moving
    const animationConfigs = [
      { value: animatedValues.value1, duration: 45000, delay: 0 },        // Blue line
      { value: animatedValues.value2, duration: 52000, delay: 2000 },     // Green line
      { value: animatedValues.value3, duration: 48000, delay: 4000 },     // Orange line
      { value: animatedValues.value4, duration: 55000, delay: 6000 },     // Purple vertical
      { value: animatedValues.value5, duration: 58000, delay: 8000 },     // Red vertical
      { value: animatedValues.value6, duration: 50000, delay: 10000 },    // Cyan diagonal
      { value: animatedValues.value7, duration: 62000, delay: 12000 },    // Lime middle
      { value: animatedValues.value8, duration: 46000, delay: 14000 },    // Orange accent
      { value: animatedValues.value9, duration: 54000, delay: 16000 },    // Indigo reverse
      { value: animatedValues.value10, duration: 49000, delay: 18000 },   // Green vertical
      
      // Second wave of dots on same lines for continuous movement
      { value: animatedValues.value11, duration: 45000, delay: 22500 },   // Blue line (half cycle offset)
      { value: animatedValues.value12, duration: 52000, delay: 28000 },   // Green line (offset)
      { value: animatedValues.value13, duration: 48000, delay: 28000 },   // Orange line (offset)
      { value: animatedValues.value14, duration: 50000, delay: 35000 },   // Purple diagonal (offset)
      { value: animatedValues.value15, duration: 58000, delay: 33000 },   // Red vertical (offset)
      { value: animatedValues.value16, duration: 62000, delay: 43000 },   // Lime middle (offset)
      { value: animatedValues.value17, duration: 46000, delay: 37000 },   // Orange accent (offset)
      { value: animatedValues.value18, duration: 54000, delay: 41000 },   // Indigo reverse (offset)
      { value: animatedValues.value19, duration: 49000, delay: 39000 },   // Green vertical (offset)
      { value: animatedValues.value20, duration: 51000, delay: 45000 },   // Cross line
    ];

    const timeouts = animationConfigs.map(({ value, duration, delay }) => {
      return setTimeout(() => {
        Animated.loop(
          Animated.timing(value, {
            toValue: 1,
            duration,
            useNativeDriver: false, // Consistent non-native driver
          })
        ).start();
      }, delay);
    });

    // Cleanup function
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      animationConfigs.forEach(({ value }) => {
        value.stopAnimation();
        value.setValue(0);
      });
    };
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

          <LinearGradient id="gradient10" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#A855F7" stopOpacity="0" />
            <Stop offset="30%" stopColor="#A855F7" stopOpacity="0.6" />
            <Stop offset="70%" stopColor="#9333EA" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient11" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#14B8A6" stopOpacity="0" />
            <Stop offset="50%" stopColor="#14B8A6" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient12" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F43F5E" stopOpacity="0" />
            <Stop offset="50%" stopColor="#F43F5E" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient13" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
            <Stop offset="50%" stopColor="#6366F1" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="gradient14" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#22C55E" stopOpacity="0" />
            <Stop offset="50%" stopColor="#22C55E" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
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

        <Path
          d="M-100,350 Q250,300 600,360 Q950,420 1300,380 Q1500,360 1700,400"
          stroke="url(#gradient10)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.6"
        />

        <Path
          d="M500,-100 Q480,200 520,400 Q560,600 540,800 Q520,900 500,1000"
          stroke="url(#gradient11)"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />

        <Path
          d="M-100,600 Q300,540 700,600 Q1100,660 1500,620 Q1600,610 1700,630"
          stroke="url(#gradient12)"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />

        <Path
          d="M1700,300 Q1300,260 900,320 Q500,380 100,340 Q0,330 -100,350"
          stroke="url(#gradient13)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.5"
        />

        <Path
          d="M900,-100 Q880,250 920,450 Q860,650 900,850 Q940,950 900,1000"
          stroke="url(#gradient14)"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />

        <Path
          d="M-100,150 Q400,190 800,130 Q1200,70 1600,110"
          stroke="url(#gradient1)"
          strokeWidth="1.8"
          fill="none"
          opacity="0.4"
        />

        <Path
          d="M-100,750 Q500,710 900,770 Q1300,830 1700,790"
          stroke="url(#gradient2)"
          strokeWidth="1.8"
          fill="none"
          opacity="0.4"
        />

        <Path
          d="M1700,450 Q1200,490 800,430 Q400,370 -100,410"
          stroke="url(#gradient10)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.3"
        />

        {/* Animated Moving Dots - More Dots for Busier Metro */}
        <G>
          {/* Primary Line Dots */}
          <AnimatedCircle
            r="5"
            fill="#3B82F6"
            opacity="0.9"
            animatedValue={animatedValues.value1}
            path="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
          />
          <AnimatedCircle
            r="4"
            fill="#10B981"
            opacity="0.8"
            animatedValue={animatedValues.value2}
            path="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
          />
          <AnimatedCircle
            r="4"
            fill="#F59E0B"
            opacity="0.7"
            animatedValue={animatedValues.value3}
            path="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
          />
          <AnimatedCircle
            r="3"
            fill="#8B5CF6"
            opacity="0.6"
            animatedValue={animatedValues.value4}
            path="M200,-100 Q180,100 220,300 Q260,500 240,700 Q220,800 200,1000"
          />
          <AnimatedCircle
            r="3"
            fill="#EF4444"
            opacity="0.6"
            animatedValue={animatedValues.value5}
            path="M1200,-100 Q1180,150 1220,350 Q1160,550 1200,750 Q1240,850 1200,1000"
          />
          
          {/* Additional Dots on Same Lines - Matching Colors */}
          <AnimatedCircle
            r="4"
            fill="#6366F1"
            opacity="0.6"
            animatedValue={animatedValues.value11}
            path="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
          />
          <AnimatedCircle
            r="3"
            fill="#047857"
            opacity="0.5"
            animatedValue={animatedValues.value12}
            path="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
          />
          <AnimatedCircle
            r="3"
            fill="#D97706"
            opacity="0.5"
            animatedValue={animatedValues.value13}
            path="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
          />
          
          {/* Secondary Lines */}
          <AnimatedCircle
            r="4"
            fill="#A855F7"
            opacity="0.7"
            animatedValue={animatedValues.value6}
            path="M-100,350 Q250,300 600,360 Q950,420 1300,380 Q1500,360 1700,400"
          />
          <AnimatedCircle
            r="3"
            fill="#14B8A6"
            opacity="0.6"
            animatedValue={animatedValues.value7}
            path="M500,-100 Q480,200 520,400 Q560,600 540,800 Q520,900 500,1000"
          />
          <AnimatedCircle
            r="3"
            fill="#F43F5E"
            opacity="0.5"
            animatedValue={animatedValues.value8}
            path="M-100,600 Q300,540 700,600 Q1100,660 1500,620 Q1600,610 1700,630"
          />
          <AnimatedCircle
            r="4"
            fill="#6366F1"
            opacity="0.6"
            animatedValue={animatedValues.value9}
            path="M1700,300 Q1300,260 900,320 Q500,380 100,340 Q0,330 -100,350"
          />
          <AnimatedCircle
            r="3"
            fill="#22C55E"
            opacity="0.5"
            animatedValue={animatedValues.value10}
            path="M900,-100 Q880,250 920,450 Q860,650 900,850 Q940,950 900,1000"
          />
          
          {/* More Secondary Line Dots - Matching Colors */}
          <AnimatedCircle
            r="3"
            fill="#7C3AED"
            opacity="0.4"
            animatedValue={animatedValues.value14}
            path="M-100,350 Q250,300 600,360 Q950,420 1300,380 Q1500,360 1700,400"
          />
          <AnimatedCircle
            r="2"
            fill="#0D9488"
            opacity="0.4"
            animatedValue={animatedValues.value15}
            path="M500,-100 Q480,200 520,400 Q560,600 540,800 Q520,900 500,1000"
          />
          <AnimatedCircle
            r="3"
            fill="#E11D48"
            opacity="0.3"
            animatedValue={animatedValues.value16}
            path="M-100,600 Q300,540 700,600 Q1100,660 1500,620 Q1600,610 1700,630"
          />
          <AnimatedCircle
            r="2"
            fill="#4F46E5"
            opacity="0.4"
            animatedValue={animatedValues.value17}
            path="M1700,300 Q1300,260 900,320 Q500,380 100,340 Q0,330 -100,350"
          />
          <AnimatedCircle
            r="3"
            fill="#16A34A"
            opacity="0.3"
            animatedValue={animatedValues.value18}
            path="M900,-100 Q880,250 920,450 Q860,650 900,850 Q940,950 900,1000"
          />
          
          {/* Cross Lines */}
          <AnimatedCircle
            r="2"
            fill="#06B6D4"
            opacity="0.4"
            animatedValue={animatedValues.value19}
            path="M-100,150 Q400,190 800,130 Q1200,70 1600,110"
          />
          <AnimatedCircle
            r="3"
            fill="#EC4899"
            opacity="0.5"
            animatedValue={animatedValues.value20}
            path="M-100,750 Q500,710 900,770 Q1300,830 1700,790"
          />
        </G>


      </Svg>
    </View>
  );
};

// Custom animated circle component that moves along a path
const AnimatedCircle = ({ r, fill, opacity, animatedValue, path }) => {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  
  React.useEffect(() => {
    const listener = animatedValue.addListener(({ value }) => {
      // Simple path interpolation for demo - parse the path and interpolate
      const pathPoints = parsePathToPoints(path);
      if (pathPoints.length > 0) {
        const index = Math.floor(value * (pathPoints.length - 1));
        const nextIndex = Math.min(index + 1, pathPoints.length - 1);
        const progress = (value * (pathPoints.length - 1)) - index;
        
        const currentPoint = pathPoints[index];
        const nextPoint = pathPoints[nextIndex];
        
        const x = currentPoint.x + (nextPoint.x - currentPoint.x) * progress;
        const y = currentPoint.y + (nextPoint.y - currentPoint.y) * progress;
        
        setPosition({ x, y });
      }
    });
    
    return () => animatedValue.removeListener(listener);
  }, [animatedValue, path]);
  
  return <Circle cx={position.x} cy={position.y} r={r} fill={fill} opacity={opacity} />;
};

// Helper function to parse SVG path to points with proper curve handling
const parsePathToPoints = (pathString) => {
  const points = [];
  
  // Parse SVG path commands (M, Q, L)
  const commands = pathString.match(/[MQL][^MQL]*/g);
  if (!commands) return [{ x: 0, y: 0 }];
  
  let currentPoint = { x: 0, y: 0 };
  
  commands.forEach(command => {
    const type = command[0];
    const coords = command.slice(1).match(/-?\d+\.?\d*/g);
    
    if (!coords) return;
    
    if (type === 'M') {
      // Move to
      currentPoint = { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
      points.push({ ...currentPoint });
    } else if (type === 'Q') {
      // Quadratic Bezier curve
      for (let i = 0; i < coords.length; i += 4) {
        const controlX = parseFloat(coords[i]);
        const controlY = parseFloat(coords[i + 1]);
        const endX = parseFloat(coords[i + 2]);
        const endY = parseFloat(coords[i + 3]);
        
        // Generate points along the quadratic curve
        for (let t = 0; t <= 1; t += 0.02) { // Higher density for smoother curves
          const x = Math.pow(1 - t, 2) * currentPoint.x + 
                   2 * (1 - t) * t * controlX + 
                   Math.pow(t, 2) * endX;
          const y = Math.pow(1 - t, 2) * currentPoint.y + 
                   2 * (1 - t) * t * controlY + 
                   Math.pow(t, 2) * endY;
          points.push({ x, y });
        }
        
        currentPoint = { x: endX, y: endY };
      }
    } else if (type === 'L') {
      // Line to
      const endX = parseFloat(coords[0]);
      const endY = parseFloat(coords[1]);
      
      // Linear interpolation
      for (let t = 0; t <= 1; t += 0.05) {
        const x = currentPoint.x + (endX - currentPoint.x) * t;
        const y = currentPoint.y + (endY - currentPoint.y) * t;
        points.push({ x, y });
      }
      
      currentPoint = { x: endX, y: endY };
    }
  });
  
  return points.length > 0 ? points : [{ x: 0, y: 0 }];
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    opacity: 1, // Higher opacity to see moving dots clearly
  },
  svg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default MetroBackground;