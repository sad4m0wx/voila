import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

const ADDRESS_TAGS = [
  { key: 'home', label: 'Home', icon: 'home', color: '#6366f1' },
  { key: 'work', label: 'Work', icon: 'work', color: '#059669' },
  { key: 'other', label: 'Other', icon: 'place', color: '#dc2626' }
];

const AddressPicker = ({
  visible,
  onClose,
  onSelectAddress,
  title = "Select Address",
  emptyMessage = "You don't have any saved addresses yet.",
  actionMessage = "Add addresses in your profile to see them here."
}) => {
  const { user, addresses, loadUserAddresses } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.uid) {
      loadUserAddresses(user.uid);
    }
  }, [visible, user?.uid, loadUserAddresses]);

  const getTagInfo = (tag) => {
    return ADDRESS_TAGS.find(t => t.key === tag) || ADDRESS_TAGS[0];
  };

  const handleSelectAddress = (address) => {
    const selectedData = {
      id: address.id,
      name: address.name,
      address: address.formatted_address,
      coordinates: [address.longitude, address.latitude],
      placeId: address.place_id,
      tag: address.tag,
      isDefault: address.is_default
    };
    
    onSelectAddress && onSelectAddress(selectedData);
    onClose && onClose();
  };

  const handleAddAddress = () => {
    Alert.alert(
      'Add Address',
      'Go to your profile to add a new address.',
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {addresses && addresses.length > 0 ? (
            <>
              {addresses.map((address) => {
                const tagInfo = getTagInfo(address.tag);
                return (
                  <TouchableOpacity
                    key={address.id}
                    style={styles.addressCard}
                    onPress={() => handleSelectAddress(address)}
                  >
                    <View style={styles.addressHeader}>
                      <View style={styles.addressTag}>
                        <MaterialIcons 
                          name={tagInfo.icon} 
                          size={20} 
                          color={tagInfo.color} 
                        />
                        <Text style={[styles.addressTagText, { color: tagInfo.color }]}>
                          {tagInfo.label}
                        </Text>
                        {address.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
                    </View>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {address.formatted_address}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              
              {/* Add more addresses button */}
              {addresses.length < 3 && (
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={handleAddAddress}
                >
                  <MaterialIcons name="add" size={24} color="#6366f1" />
                  <Text style={styles.addButtonText}>Add Another Address</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            /* Empty state */
            <View style={styles.emptyState}>
              <MaterialIcons name="place" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{emptyMessage}</Text>
              <Text style={styles.emptyMessage}>{actionMessage}</Text>
              <TouchableOpacity 
                style={styles.addFirstButton}
                onPress={handleAddAddress}
              >
                <MaterialIcons name="add" size={20} color="#ffffff" />
                <Text style={styles.addFirstButtonText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTag: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressTagText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  defaultBadge: {
    marginLeft: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8faff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  addFirstButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default AddressPicker; 