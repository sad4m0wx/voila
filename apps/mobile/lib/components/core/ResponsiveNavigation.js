import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView 
} from 'react-native';

const ResponsiveNavigation = ({ 
  currentRoute = 'home',
  onNavigate,
  showUserInfo = false,
  style 
}) => {
  const navigationItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'history', label: 'History', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <SafeAreaView className="bg-white border-t border-gray-200" style={style}>
      <View className="flex-row items-center justify-between px-4 py-2">
        {/* Navigation Items */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="flex-1"
        >
          <View className="flex-row space-x-6">
            {navigationItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onNavigate?.(item.id)}
                className={`flex-col items-center justify-center py-2 px-3 rounded-lg ${
                  currentRoute === item.id 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-transparent'
                }`}
              >
                <Text className="text-lg mb-1">{item.icon}</Text>
                <Text 
                  className={`text-xs font-medium ${
                    currentRoute === item.id 
                      ? 'text-blue-600' 
                      : 'text-gray-600'
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* App Info */}
        {showUserInfo && (
          <View className="ml-4 flex-row items-center">
            <View className="flex-col items-end">
              <Text className="text-sm font-medium text-gray-900">
                Voilà!
              </Text>
              <Text className="text-xs text-gray-500">
                Meeting Point Finder
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default ResponsiveNavigation; 