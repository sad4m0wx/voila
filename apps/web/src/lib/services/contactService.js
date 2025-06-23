import { Contacts } from '@capacitor-community/contacts';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { authStore } from '$stores/auth';
import { get } from 'svelte/store';

/**
 * Request permission to access contacts
 * @returns {Promise<boolean>} Whether permission was granted
 */
export async function requestContactsPermission() {
  try {
    const result = await Contacts.requestPermissions();
    return result.contacts === 'granted';
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    return false;
  }
}

/**
 * Check if contacts permission is already granted
 * @returns {Promise<boolean>} Whether permission is granted
 */
export async function checkContactsPermission() {
  try {
    const result = await Contacts.checkPermissions();
    return result.contacts === 'granted';
  } catch (error) {
    console.error('Error checking contacts permission:', error);
    return false;
  }
}

/**
 * Get all contacts from the device
 * @returns {Promise<Array>} Array of contacts
 */
export async function getDeviceContacts() {
  try {
    const hasPermission = await checkContactsPermission();
    if (!hasPermission) {
      const permissionGranted = await requestContactsPermission();
      if (!permissionGranted) {
        throw new Error('Contacts permission denied');
      }
    }

    const result = await Contacts.getContacts({
      projection: {
        name: true,
        phones: true,
        emails: true,
        image: true
      }
    });

    return result.contacts || [];
  } catch (error) {
    console.error('Error getting device contacts:', error);
    throw error;
  }
}

/**
 * Extract and normalize phone numbers from a contact
 * @param {Object} contact - Contact object from device
 * @returns {Array<string>} Array of normalized phone numbers
 */
function extractPhoneNumbers(contact) {
  if (!contact.phones || !Array.isArray(contact.phones)) {
    return [];
  }

  return contact.phones
    .map(phone => phone.number)
    .filter(number => number && typeof number === 'string')
    .map(number => {
      // Remove all non-digit characters except +
      let cleaned = number.replace(/[^\d+]/g, '');
      
      // If it doesn't start with +, add country code (assuming US for now)
      if (!cleaned.startsWith('+')) {
        // If it's a 10-digit number, assume US
        if (cleaned.length === 10) {
          cleaned = '+1' + cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
          cleaned = '+' + cleaned;
        }
      }
      
      return cleaned;
    })
    .filter(number => number.length >= 10); // Filter out invalid numbers
}

/**
 * Find users in your app that match contacts from the device
 * @param {Array} deviceContacts - Array of device contacts
 * @returns {Promise<Array>} Array of matching users with contact info
 */
export async function findContactsInApp(deviceContacts) {
  try {
    const auth = get(authStore);
    if (!auth.user) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const usersRef = collection(db, 'users');
    
    // Extract all phone numbers from all contacts
    const allPhoneNumbers = deviceContacts.reduce((acc, contact) => {
      const phoneNumbers = extractPhoneNumbers(contact);
      phoneNumbers.forEach(phone => {
        acc.push({
          phone,
          contact: {
            name: contact.name?.display || contact.name?.given || 'Unknown',
            phones: contact.phones,
            contactId: contact.contactId
          }
        });
      });
      return acc;
    }, []);

    if (allPhoneNumbers.length === 0) {
      return [];
    }

    // Firestore has a limit of 10 items in 'in' queries, so we need to batch
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < allPhoneNumbers.length; i += batchSize) {
      const batch = allPhoneNumbers.slice(i, i + batchSize);
      const phoneNumbers = batch.map(item => item.phone);
      
      const q = query(
        usersRef,
        where('phoneNumber', 'in', phoneNumbers),
        where('__name__', '!=', auth.user.uid) // Exclude current user
      );
      
      batches.push({ query: q, batch });
    }

    // Execute all batch queries
    const results = await Promise.all(
      batches.map(async ({ query: q, batch }) => {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
          const userData = doc.data();
          const matchingContact = batch.find(item => item.phone === userData.phoneNumber);
          
          return {
            userId: doc.id,
            displayName: userData.displayName || 'Unknown User',
            photoURL: userData.photoURL || null,
            phoneNumber: userData.phoneNumber,
            contactInfo: matchingContact ? matchingContact.contact : null
          };
        });
      })
    );

    // Flatten results and remove duplicates
    const flatResults = results.flat();
    const uniqueResults = flatResults.filter((user, index, self) => 
      index === self.findIndex(u => u.userId === user.userId)
    );

    return uniqueResults;
  } catch (error) {
    console.error('Error finding contacts in app:', error);
    throw error;
  }
}

/**
 * Get contacts that are already friends
 * @param {Array} contactMatches - Array of contact matches from findContactsInApp
 * @param {Array} currentFriends - Array of current friends
 * @returns {Array} Array of contacts that are already friends
 */
export function getExistingFriends(contactMatches, currentFriends) {
  const friendIds = new Set(currentFriends.map(friend => friend.id));
  return contactMatches.filter(contact => friendIds.has(contact.userId));
}

/**
 * Get contacts that can be added as friends
 * @param {Array} contactMatches - Array of contact matches from findContactsInApp
 * @param {Array} currentFriends - Array of current friends
 * @param {Array} outgoingRequests - Array of outgoing friend requests
 * @returns {Array} Array of contacts that can be added as friends
 */
export function getSuggestedFriends(contactMatches, currentFriends, outgoingRequests) {
  const friendIds = new Set(currentFriends.map(friend => friend.id));
  const requestIds = new Set(outgoingRequests.map(req => req.receiverId));
  
  return contactMatches.filter(contact => 
    !friendIds.has(contact.userId) && !requestIds.has(contact.userId)
  );
} 