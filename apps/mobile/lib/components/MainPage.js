import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert
} from 'react-native';
import { findOptimalMeetingPoint } from '../services/meetingPointApi';
import { AddressForm, MeetingPointDisplay } from './meeting';
import { LoadingIndicator } from './utils';
import { ResponsiveNavigation } from './core';
import MetroBackground from './core/MetroBackground';

const MainPage = () => {
  // State
  const [addresses, setAddresses] = useState([
    { id: 1, value: '', coordinates: null }, 
    { id: 2, value: '', coordinates: null }
  ]);
  const [meetingPoint, setMeetingPoint] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('home');

  // Find meeting point
  const handleFindMeetingPoint = async (formAddresses) => {
    setError(null);
    setIsCalculating(true);
    setShowResults(false);

    try {
      // Validate inputs
      if (formAddresses.some(addr => !addr.value.trim())) {
        throw new Error("All addresses must be filled");
      }

      // Calculate meeting point
      const result = await findOptimalMeetingPoint(formAddresses, {
        venueTypes: ["restaurant"],
        venueRadius: 500,
        showVenues: true
      });

      setMeetingPoint({
        name: result.name,
        coordinates: result.coordinates,
        travelTimes: result.travelTimes
      });

      setShowResults(true);
    } catch (err) {
      console.error("Error finding meeting point:", err);
      setError(err.message || "Failed to calculate meeting point. Please try again.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Start new search
  const handleStartNewSearch = () => {
    setMeetingPoint(null);
    setShowResults(false);
    setError(null);
    setMapExpanded(false);
  };

  // Handle save location
  const handleSaveLocation = () => {
    Alert.alert(
      'Save Location',
      'Location saving feature will be implemented in the next phase.',
      [{ text: 'OK' }]
    );
  };

  // Navigation handler
  const handleNavigate = (route) => {
    setCurrentRoute(route);
    Alert.alert(
      'Navigation',
      `Navigation to ${route} will be implemented with full app routing.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <MetroBackground />
      
      <View className="flex-1 relative z-10">
        {/* Map Area - Top Priority */}
        <View className={`${mapExpanded ? 'h-96' : showResults ? 'h-64' : 'h-80'} transition-all duration-300 relative mx-4 mb-4`}>
          {/* Map Header with Controls */}
          <View className="absolute top-3 left-3 right-3 z-20 flex-row items-center justify-between">
            {/* Floating Logo */}
            <View className="bg-white/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-white/20">
              <View className="flex-row items-center">
                <Text className="text-xl mr-2">📍</Text>
                <View>
                  <Text className="text-sm font-bold text-gray-800">Voilà!</Text>
                </View>
              </View>
            </View>
            
            {/* Map Controls */}
            <View className="flex-row items-center space-x-2">
              {/* Settings Button */}
              <TouchableOpacity 
                onPress={() => handleNavigate('settings')}
                className="w-10 h-10 bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 rounded-2xl flex items-center justify-center"
              >
                <Text className="text-gray-700">⚙️</Text>
              </TouchableOpacity>
              
              {/* Map Expand Button */}
              {meetingPoint && (
                <TouchableOpacity
                  className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 flex items-center justify-center"
                  onPress={() => setMapExpanded(!mapExpanded)}
                >
                  <Text className="text-gray-700">
                    {mapExpanded ? '⤡' : '⤢'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Map Placeholder */}
          <View className="h-full rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-blue-100/80 to-purple-100/80 backdrop-blur-sm border-2 border-blue-200/50">
            <View className="flex-1 items-center justify-center">
              <Text className="text-4xl mb-2">🗺️</Text>
              <Text className="text-gray-600 text-center px-4">
                Interactive map will be displayed here
              </Text>
              {meetingPoint && (
                <View className="mt-4 bg-white/90 rounded-lg p-3">
                  <Text className="text-sm font-medium text-center">
                    📍 {meetingPoint.name}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Content Below Map */}
        <ScrollView className="flex-1 px-4 pb-20">
          <View className="space-y-4">
            {/* Loading State */}
            {isCalculating && (
              <View className="bg-white rounded-2xl p-6 shadow-lg">
                <LoadingIndicator 
                  text="Finding the perfect meeting spot..."
                  color="#3b82f6"
                />
              </View>
            )}

            {/* Error State */}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <Text className="text-red-600 font-medium mb-2">Oops!</Text>
                <Text className="text-red-600 text-sm">{error}</Text>
                <TouchableOpacity
                  onPress={() => setError(null)}
                  className="mt-3 bg-red-500 rounded-lg py-2 px-4 self-start"
                >
                  <Text className="text-white text-sm font-medium">Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Results Section */}
            {showResults && meetingPoint ? (
              <MeetingPointDisplay
                meetingPoint={meetingPoint}
                onStartNewSearch={handleStartNewSearch}
                onCreateGroup={handleSaveLocation}
              />
            ) : (
              /* Address Form Section */
              <AddressForm
                addresses={addresses}
                onAddressesChange={setAddresses}
                onFindMeetingPoint={handleFindMeetingPoint}
                isCalculating={isCalculating}
              />
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <ResponsiveNavigation
          currentRoute={currentRoute}
          onNavigate={handleNavigate}
          showUserInfo={false}
        />
      </View>
    </SafeAreaView>
  );
};

export default MainPage; 