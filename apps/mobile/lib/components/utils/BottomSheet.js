import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  ScrollView,
  Dimensions 
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

const BottomSheet = ({
  visible = false,
  onClose,
  title,
  children,
  maxHeight = screenHeight * 0.8,
  snapPoints = ['50%', '80%'],
  showCloseButton = true,
  closeOnBackdrop = true
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Pressable 
          className="flex-1 bg-black/50" 
          onPress={closeOnBackdrop ? onClose : undefined}
        />
        
        {/* Bottom Sheet Content */}
        <View 
          className="bg-white rounded-t-lg"
          style={{ maxHeight }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            {/* Handle bar */}
            <View className="absolute top-2 left-1/2 transform -translate-x-1/2">
              <View className="w-12 h-1 bg-gray-300 rounded-full" />
            </View>
            
            {title && (
              <Text className="text-lg font-semibold text-gray-900 mt-4">
                {title}
              </Text>
            )}
            
            {showCloseButton && (
              <Pressable 
                onPress={onClose}
                className="p-2 mt-4"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-2xl text-gray-400">×</Text>
              </Pressable>
            )}
          </View>
          
          {/* Content */}
          <ScrollView 
            className="flex-1 p-4"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default BottomSheet; 