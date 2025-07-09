import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../lib/contexts/AuthContext';
import { GradientView } from '../../lib/components/core';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isFullyOnboarded } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 12,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => focused ? (
            <GradientView
              gradientName="lightPurple"
              style={{
                borderRadius: 12,
                padding: 6,
                minWidth: 48,
                minHeight: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons 
                name="place" 
                size={24} 
                color={color} 
              />
            </GradientView>
          ) : (
            <View style={{
              borderRadius: 12,
              padding: 6,
              minWidth: 48,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialIcons 
                name="place" 
                size={22} 
                color={color} 
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => focused ? (
            <GradientView
              gradientName="lightPurple"
              style={{
                borderRadius: 12,
                padding: 6,
                minWidth: 48,
                minHeight: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons 
                name="group" 
                size={24} 
                color={color} 
              />
            </GradientView>
          ) : (
            <View style={{
              borderRadius: 12,
              padding: 6,
              minWidth: 48,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialIcons 
                name="group" 
                size={22} 
                color={color} 
              />
            </View>
          ),
          // Hide groups tab for non-authenticated users
          href: user && isFullyOnboarded ? '/groups' : null,
        }}
      />
    </Tabs>
  );
}
