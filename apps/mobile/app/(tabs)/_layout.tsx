import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme, View, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../lib/contexts/AuthContext';
import { GradientView } from '../../lib/components/core';
import { GRADIENTS } from '../../lib/theme/gradients';

const TAB_ICON_SIZE = 24;
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 70;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 16;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isFullyOnboarded } = useAuth();
  
  const isDark = colorScheme === 'dark';
  
  const tabBarStyle = {
    backgroundColor: isDark ? '#ffffff' : '#ffffff',
    borderTopWidth: 0,
    height: TAB_BAR_HEIGHT,
    paddingBottom: BOTTOM_INSET,
    paddingTop: 8,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 16,
    position: 'absolute',
  };

  const TabIcon = ({ name, color, focused }) => {
    if (focused) {
      return (
        <GradientView
          gradientName="blueToMagenta"
          style={{
            borderRadius: 16,
            padding: 10,
            minWidth: 52,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: GRADIENTS.blueToMagenta.colors[0],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <MaterialIcons 
            name={name} 
            size={TAB_ICON_SIZE} 
            color="#ffffff"
          />
        </GradientView>
      );
    }

    return (
      <View style={{
        borderRadius: 16,
        padding: 10,
        minWidth: 52,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}>
        <MaterialIcons 
          name={name} 
          size={TAB_ICON_SIZE} 
          color={isDark ? '#9ca3af' : '#6b7280'} 
        />
      </View>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: GRADIENTS.blueToMagenta.colors[0],
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 4,
          marginBottom: Platform.OS === 'ios' ? 0 : -4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="place" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="group" color={color} focused={focused} />
          ),
          href: user && isFullyOnboarded ? '/groups' : null,
        }}
      />
    </Tabs>
  );
}
