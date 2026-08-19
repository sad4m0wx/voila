const Capacitor = (typeof window !== 'undefined' && window.Capacitor) || { isNativePlatform: () => false, getPlatform: () => 'web' };

let _Contacts = null;
async function getContacts() {
  if (!_Contacts) {
    try {
      const m = await import(/* @vite-ignore */ '@capacitor-community/contacts');
      _Contacts = m.Contacts;
    } catch {
      _Contacts = null;
    }
  }
  return _Contacts;
}

/**
 * ContactService - A service for managing contacts using the official Capacitor Contacts plugin
 */
export class ContactService {
  /**
   * Check if the app has permission to access contacts
   * @returns {Promise<{granted: boolean, message?: string}>}
   */
  static async checkPermission() {
    if (!Capacitor.isNativePlatform()) {
      return { granted: false, message: 'Not available on web platform' };
    }

    try {
      const Contacts = await getContacts();
      const result = await Contacts.checkPermissions();
      return { 
        granted: result.contacts === 'granted',
        message: `Permission status: ${result.contacts}`
      };
    } catch (error) {
      console.error('Error checking contacts permission:', error);
      return { 
        granted: false, 
        message: `Error: ${error.message}` 
      };
    }
  }

  /**
   * Request permission to access contacts
   * @returns {Promise<{granted: boolean, message?: string}>}
   */
  static async requestPermission() {
    if (!Capacitor.isNativePlatform()) {
      return { granted: false, message: 'Not available on web platform' };
    }

    try {
      const Contacts = await getContacts();
      const result = await Contacts.requestPermissions();
      return { 
        granted: result.contacts === 'granted',
        message: `Permission request result: ${result.contacts}`
      };
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return { 
        granted: false, 
        message: `Error: ${error.message}` 
      };
    }
  }

  /**
   * Get all contacts from the device
   * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>}
   */
  static async getContacts() {
    if (!Capacitor.isNativePlatform()) {
      return { 
        success: false, 
        error: 'Contacts not available on web platform' 
      };
    }

    try {
      // First check if we have permission
      const permissionResult = await this.checkPermission();
      if (!permissionResult.granted) {
        return { 
          success: false, 
          error: 'No permission to access contacts' 
        };
      }

      // Get all contacts
      const Contacts = await getContacts();
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
          emails: true,
          image: false, // Skip image for performance
        }
      });

      return { 
        success: true, 
        contacts: result.contacts || [] 
      };
    } catch (error) {
      console.error('Error getting contacts:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get contacts with phone numbers only
   * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>}
   */
  static async getContactsWithPhones() {
    const result = await this.getContacts();
    
    if (!result.success) {
      return result;
    }

    // Filter contacts that have phone numbers
    const contactsWithPhones = result.contacts.filter(contact => 
      contact.phones && contact.phones.length > 0
    );

    return {
      success: true,
      contacts: contactsWithPhones
    };
  }

  /**
   * Check if contacts are supported on this platform
   * @returns {boolean}
   */
  static isSupported() {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get platform info for contacts
   * @returns {object}
   */
  static getPlatformInfo() {
    return {
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      isSupported: this.isSupported()
    };
  }
}

export default ContactService; 