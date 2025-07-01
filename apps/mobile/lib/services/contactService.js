import * as Contacts from 'expo-contacts';
import { Alert } from 'react-native';
import { normalizePhoneNumber } from '../utils/phoneUtils';

class ContactService {
  constructor() {
    this.hasPermission = false;
    this.contacts = [];
  }

  // Request permission to access contacts
  async requestPermission() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }

  // Load contacts from device
  async loadContacts() {
    if (!this.hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error('Contact permission denied');
      }
    }

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      // Process and normalize contacts
      this.contacts = data
        .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map(contact => ({
          id: contact.id,
          name: contact.name || 'Unknown',
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          phoneNumbers: contact.phoneNumbers.map(phone => ({
            number: phone.number,
            normalized: normalizePhoneNumber(phone.number),
            label: phone.label || 'mobile'
          })),
          emails: contact.emails || []
        }));

      return this.contacts;
    } catch (error) {
      console.error('Error loading contacts:', error);
      throw error;
    }
  }

  // Search contacts by name or phone
  searchContacts(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const term = searchTerm.toLowerCase().trim();
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{8,}$/;
    const isPhoneSearch = phoneRegex.test(term);

    return this.contacts.filter(contact => {
      // Search by name
      const nameMatch = contact.name.toLowerCase().includes(term) ||
                       contact.firstName.toLowerCase().includes(term) ||
                       contact.lastName.toLowerCase().includes(term);

      // Search by phone number
      const phoneMatch = contact.phoneNumbers.some(phone => 
        phone.number.includes(term) || 
        phone.normalized.includes(normalizePhoneNumber(term))
      );

      return isPhoneSearch ? phoneMatch : (nameMatch || phoneMatch);
    }).slice(0, 10); // Limit results
  }

  // Get contacts not registered in the app
  async getUnregisteredContacts(registeredUsers = []) {
    const registeredPhones = new Set(
      registeredUsers.map(user => normalizePhoneNumber(user.phone_number))
    );

    return this.contacts.filter(contact => {
      return !contact.phoneNumbers.some(phone => 
        registeredPhones.has(phone.normalized)
      );
    });
  }

  // Find contacts by phone numbers
  findContactsByPhones(phoneNumbers) {
    const normalizedPhones = new Set(
      phoneNumbers.map(phone => normalizePhoneNumber(phone))
    );

    return this.contacts.filter(contact => 
      contact.phoneNumbers.some(phone => 
        normalizedPhones.has(phone.normalized)
      )
    );
  }

  // Check if we have contacts loaded
  hasContacts() {
    return this.contacts.length > 0;
  }

  // Get permission status
  async getPermissionStatus() {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      this.hasPermission = status === 'granted';
      return status;
    } catch (error) {
      console.error('Error getting contacts permission status:', error);
      return 'undetermined';
    }
  }

  // Show permission request dialog
  async showPermissionDialog() {
    return new Promise((resolve) => {
      Alert.alert(
        'Access Contacts',
        'To invite friends who aren\'t on the app yet, we need permission to access your contacts.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Allow',
            onPress: async () => {
              const granted = await this.requestPermission();
              resolve(granted);
            }
          }
        ]
      );
    });
  }
}

export const contactService = new ContactService();
export default contactService; 