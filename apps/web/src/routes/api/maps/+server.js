// TODO: Move this somewhere else
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Access the API key from server environment variable (not exposed to client)
const GOOGLE_MAPS_GEOCODE_API_KEY = env.VITE_GOOGLE_MAPS_GEOCODE_API_KEY;

// Create a proxy for geocoding requests
export async function POST({ request }) {
  try {
    const { action, payload } = await request.json();

    if (!GOOGLE_MAPS_GEOCODE_API_KEY) {
      throw new Error('Google Maps API key not configured on server');
    }

    let response = await geocodeAddress(payload.address);
    return json(response);

  } catch (err) {
    console.error('Maps API error:', err);
    throw error(500, { message: err.message });
  }
}

// Geocode an address to coordinates
async function geocodeAddress(address) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.append('address', address);
  url.searchParams.append('key', GOOGLE_MAPS_GEOCODE_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  return {
    address: result.formatted_address,
    coordinates: [
      result.geometry.location.lng,
      result.geometry.location.lat
    ],
    placeId: result.place_id
  };
}