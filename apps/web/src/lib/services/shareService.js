// Share service for web app
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || '';

/**
 * Create a shareable link for meeting point results
 * @param {Array} addresses - The addresses used to generate the meeting point (web app format)
 * @returns {Promise<Object>} Share response with URLs
 */
export async function createShareLink(addresses) {
  try {
    // Transform addresses from web format to backend AddressInput format
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
      return shareData.mobileUrl || shareData.shareUrl;
      
    case 'web':
      return shareData.shareUrl;
      
    case 'auto':
    default:
      // Auto-detect best URL based on current environment
      if (typeof window === 'undefined') {
        return shareData.shareUrl; // Server-side default
      }
      
      // Check if we're in a Capacitor app
      const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
      if (isCapacitor) {
        return shareData.mobileUrl || shareData.shareUrl;
      }
      
      // For web browsers, use the smart web URL that can detect and open the app
      return shareData.shareUrl;
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
 * Share meeting point using Web Share API or fallback to clipboard
 * @param {Object} shareData - Share data with URLs and text
 * @returns {Promise<boolean>} Success status
 */
export async function shareNatively(shareData) {
  try {
    // Check if Web Share API is available
    if (navigator.share) {
      await navigator.share({
        title: shareData.title,
        text: shareData.message,
        url: shareData.url
      });
      return true;
    } else {
      // Fallback to copying to clipboard
      return await copyToClipboard(shareData.url);
    }
  } catch (error) {
    console.error('❌ Native sharing failed:', error);
    // Fallback to clipboard if sharing was cancelled or failed
    return await copyToClipboard(shareData.url);
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback to legacy method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return success;
    }
  } catch (error) {
    console.error('❌ Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Show a browser notification or fallback message
 * @param {string} message - Message to show
 * @param {string} type - Type of notification ('success', 'error', 'info')
 */
export function showNotification(message, type = 'info') {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  
  // Style the toast
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    ${type === 'success' ? 'background-color: #10b981;' : ''}
    ${type === 'error' ? 'background-color: #ef4444;' : ''}
    ${type === 'info' ? 'background-color: #3b82f6;' : ''}
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  
  if (!document.querySelector('#toast-styles')) {
    style.id = 'toast-styles';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
} 