import { error } from '@sveltejs/kit';

export async function GET({ url, fetch }) {
  const photoReference = url.searchParams.get('reference');
  const maxWidth = url.searchParams.get('maxwidth') || '400';
  
  if (!photoReference) {
    throw error(400, 'Missing photo reference');
  }
  
  // Get the API key from environment variables
  const apiKey = import.meta.env.VITE_MAPS_PLACES_API_KEY;
  
  if (!apiKey) {
    throw error(500, 'API key not configured');
  }
  
  try {
    
    // This endpoint will proxy the Google Places Photos API to avoid exposing the API key
    const googleApiUrl = `https://places.googleapis.com/v1/places/${photoReference}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
    console.log(googleApiUrl);
    // Fetch the image from Google
    const response = await fetch(googleApiUrl);
    
    if (!response.ok) {
      throw error(response.status, 'Failed to fetch photo from Google API');
    }
    
    // Get the buffer from the response
    const imageBuffer = await response.arrayBuffer();
    
    // Return the image with the correct content type
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    });
  } catch (err) {
    console.error('Error fetching venue photo:', err);
    throw error(500, 'Failed to fetch venue photo');
  }
}