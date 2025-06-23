import { writable, get } from 'svelte/store';
import { checkContactsPermission, requestContactsPermission } from './contactService.js';
import { getDeviceInfo } from '$lib/utils/platform.js';

// Store for contacts permission state
const contactsPermissionStore = writable({
  hasPermission: false,
  isChecking: false,
  isRequesting: false,
  lastChecked: null,
  error: null
});

export const contactsPermission = contactsPermissionStore;

/**
 * Check if we're on a platform that supports contacts
 */
export function isContactsSupportedPlatform() {
  const deviceInfo = getDeviceInfo();
  return deviceInfo.isNative;
}

/**
 * Initialize contacts permission state
 */
export async function initContactsPermission() {
  if (!isContactsSupportedPlatform()) {
    contactsPermissionStore.set({
      hasPermission: true, // Consider web as "having permission" for app flow
      isChecking: false,
      isRequesting: false,
      lastChecked: new Date(),
      error: null
    });
    return true;
  }

  contactsPermissionStore.update(state => ({
    ...state,
    isChecking: true,
    error: null
  }));

  try {
    const hasPermission = await checkContactsPermission();
    contactsPermissionStore.set({
      hasPermission,
      isChecking: false,
      isRequesting: false,
      lastChecked: new Date(),
      error: null
    });
    return hasPermission;
  } catch (error) {
    console.error('Error checking contacts permission:', error);
    contactsPermissionStore.update(state => ({
      ...state,
      isChecking: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Request contacts permission with UI feedback
 */
export async function requestContactsPermissionWithUI() {
  if (!isContactsSupportedPlatform()) {
    return true; // Web doesn't need permission
  }

  const currentState = get(contactsPermissionStore);
  if (currentState.hasPermission) {
    return true; // Already have permission
  }

  contactsPermissionStore.update(state => ({
    ...state,
    isRequesting: true,
    error: null
  }));

  try {
    const granted = await requestContactsPermission();
    contactsPermissionStore.update(state => ({
      ...state,
      hasPermission: granted,
      isRequesting: false,
      lastChecked: new Date(),
      error: granted ? null : 'Permission denied'
    }));
    return granted;
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    contactsPermissionStore.update(state => ({
      ...state,
      isRequesting: false,
      error: error.message
    }));
    return false;
  }
}

/**
 * Check if contacts permission is required for the app to function
 */
export function isContactsPermissionRequired() {
  return isContactsSupportedPlatform();
}

/**
 * Get permission status for UI display
 */
export function getPermissionStatus() {
  const state = get(contactsPermissionStore);
  
  if (!isContactsSupportedPlatform()) {
    return 'not-required';
  }
  
  if (state.isChecking || state.isRequesting) {
    return 'loading';
  }
  
  if (state.error) {
    return 'error';
  }
  
  return state.hasPermission ? 'granted' : 'denied';
}

/**
 * Reset permission state (useful for testing or retrying)
 */
export function resetContactsPermission() {
  contactsPermissionStore.set({
    hasPermission: false,
    isChecking: false,
    isRequesting: false,
    lastChecked: null,
    error: null
  });
} 