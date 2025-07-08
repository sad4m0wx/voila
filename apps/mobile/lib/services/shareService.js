import { CORE_API_URL } from '../config';
import { Share, Alert } from 'react-native';

// Try to import expo-clipboard with fallback
let Clipboard = null;
try {
  Clipboard = require('expo-clipboard');
} catch (error) {
  console.warn('expo-clipboard not available:', error.message);
}

/**
 * Create a shareable link for meeting point results
 * @param {Array} addresses - The addresses used to generate the meeting point (mobile app format)
 * @returns {Promise<Object>} Share response with URLs
 */
export async function createShareLink(addresses) {
  try {
    // Transform addresses from mobile format to backend AddressInput format
    const transformedAddresses = addresses
      .filter(addr => addr.value && addr.value.trim() !== '' && addr.coordinates)
      .map(addr => ({
        id: addr.id.toString(), // Convert number to string
        address: addr.value, // Map 'value' to 'address'
        coordinates: addr.coordinates ? [addr.coordinates[0], addr.coordinates[1]] : null
      }));

    if (transformedAddresses.length < 2) {
      throw new Error('At least two valid addresses are required');
    }

    const response = await fetch(`${CORE_API_URL}/api/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        addresses: transformedAddresses
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create share link');
    }

    const result = await response.json();
    
    console.log('✅ Share link created:', result.share_url);
    
    return {
      success: true,
      shareId: result.share_id,
      shareUrl: result.share_url,
      mobileUrl: result.mobile_url,
      expiresAt: result.expires_at
    };
  } catch (error) {
    console.error('❌ Failed to create share link:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the appropriate share URL based on the sharing context
 * @param {Object} shareData - Share data with both URLs
 * @param {string} [context] - Sharing context: 'native', 'web', 'auto'
 * @returns {string} The appropriate URL to share
 */
export function getShareUrl(shareData, context = 'auto') {
  if (!shareData.shareUrl) {
    throw new Error('No share URL available');
  }
  
  switch (context) {
    case 'native':
      // For native app sharing, always use the mobile deep link
      return shareData.mobileUrl || shareData.shareUrl;
      
    case 'web':
      // For web sharing, always use the web URL
      return shareData.shareUrl;
      
    case 'auto':
    default:
      // In React Native, we're always in a native app context
      // For sharing with other apps, use the web URL (smart app detection)
      // For deep linking within our own app, use the mobile URL
      return shareData.shareUrl; // Web URL handles app detection better
  }
}

/**
 * Create share content with appropriate URLs for different platforms
 * @param {Object} shareData - Share data from backend
 * @param {string} meetingPointName - Name of the meeting point
 * @returns {Object} Share content object
 */
export function createShareContent(shareData, meetingPointName = 'meeting point') {
  const webUrl = shareData.shareUrl;
  const deepLink = shareData.mobileUrl;
  
  return {
    title: 'Voilà - Meeting Point',
    message: `Check out this ${meetingPointName} I found! Open in the Voilà app or your browser.`,
    
    // URLs for different contexts
    webUrl,      // Web browser URL (smart app detection)
    deepLink,    // Direct deep link for apps
    
    // For native sharing, prefer the web URL as it handles app detection
    url: webUrl,
    
    // For copying to clipboard, provide both options
    fullText: `Check out this ${meetingPointName} I found!\n\nOpen in app: ${deepLink}\nOr in browser: ${webUrl}`
  };
}

/**
 * Get shared meeting point result by share ID
 * @param {string} shareId - The unique share identifier
 * @returns {Promise<Object>} Meeting point result or error
 */
export async function getSharedMeetingPoint(shareId) {
  try {
    const response = await fetch(`${CORE_API_URL}/api/shared/${shareId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to load shared meeting point');
    }

    const result = await response.json();
    
    console.log('✅ Loaded shared meeting point:', shareId);
    
    return {
      success: true,
      meetingPointResult: result.meeting_point_result,
      metadata: result.metadata
    };
  } catch (error) {
    console.error('❌ Failed to load shared meeting point:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Share meeting point using native sharing
 * @param {Object} shareData - Share data with URLs and text
 * @returns {Promise<boolean>} Success status
 */
export async function shareNatively(shareData) {
  try {
    // Check if Share is available
    if (!Share || typeof Share.share !== 'function') {
      console.warn('React Native Share not available');
      return false;
    }
    
    const result = await Share.share({
      message: shareData.message,
      url: shareData.url,
      title: shareData.title
    });

    return result.action !== Share.dismissedAction;
  } catch (error) {
    console.error('❌ Native sharing failed:', error);
    return false;
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    // Try expo-clipboard if available
    if (Clipboard && Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
    
    // If no clipboard is available, show an alert with the text
    Alert.alert(
      'Share Link',
      `Copy this link to share:\n\n${text}`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
    
    return true; // Consider showing the alert as success
  } catch (error) {
    console.error('❌ Failed to copy to clipboard:', error);
    
    // Fallback: show alert with the text
    Alert.alert(
      'Share Link',
      `Copy this link to share:\n\n${text}`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
    
    return true; // Consider showing the alert as success
  }
} 