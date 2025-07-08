import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

/** @type {import('./$types').PageLoad} */
export async function load({ params, url }) {
  const shareId = params.id;
  
  if (browser) {
    const shouldTryApp = tryOpenMobileApp(shareId);
    
    if (!shouldTryApp) {
      window.location.replace(`/?share=${shareId}`);
      return {};
    }
    
    setTimeout(() => {
      window.location.replace(`/?share=${shareId}`);
    }, 2000);
    
    return { shareId, attemptedAppOpen: true };
  }
  
  // Server-side: redirect immediately for non-JS browsers
  throw redirect(302, `/?share=${shareId}`);
}

/**
 * Try to open the mobile app with the shared meeting point
 * @param {string} shareId - The share ID to pass to the app
 * @returns {boolean} Whether we attempted to open the app
 */
function tryOpenMobileApp(shareId) {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  
  if (!isMobile) {
    return false; 
  }
  
  const deepLink = `voila://shared/${shareId}`;
  
  try {
    if (isIOS) {
      window.location.href = deepLink;
      return true;
    } else if (isAndroid) {
      const intentUrl = `intent://shared/${shareId}#Intent;scheme=voila;package=com.voila.mobile;end`;
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      // Clean up iframe after a short delay
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
      
      return true;
    }
  } catch (error) {
    console.warn('Failed to open mobile app:', error);
  }
  
  return false;
} 