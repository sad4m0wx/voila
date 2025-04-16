// src/routes/api/maps/+server.js
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Access the API key from server environment variable (not exposed to client)
const GOOGLE_MAPS_API_KEY = env.GOOGLE_MAPS_API_KEY;

// Create a proxy for geocoding requests
export async function POST({ request }) {
  try {
    const { action, payload } = await request.json();
    
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured on server');
    }

    let response;
    
    // Handle different types of requests
    switch (action) {
      case 'geocode':
        response = await geocodeAddress(payload.address);
        break;
      case 'directions':
        response = await getDirections(payload.origin, payload.destination, payload.mode);
        break;
      case 'places':
        response = await findNearbyPlaces(payload.location, payload.type, payload.radius);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
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
  url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
  
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

// Get directions between two points
async function getDirections(origin, destination, mode = 'transit') {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  
  // Format origin and destination as lat,lng strings
  const originStr = Array.isArray(origin) 
    ? `${origin[1]},${origin[0]}` 
    : origin;
    
  const destStr = Array.isArray(destination) 
    ? `${destination[1]},${destination[0]}`
    : destination;
  
  url.searchParams.append('origin', originStr);
  url.searchParams.append('destination', destStr);
  url.searchParams.append('mode', mode);
  url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
  
  if (mode === 'transit') {
    url.searchParams.append('transit_mode', 'bus|subway|train|tram');
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    throw new Error(`Directions request failed: ${data.status}`);
  }
  
  const route = data.routes[0];
  const leg = route.legs[0];
  
  // Extract the path coordinates
  const path = route.overview_polyline.points;
  const decodedPath = decodePath(path);
  
  // Format the response
  return {
    distance: leg.distance.value,
    duration: leg.duration.value,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    startLocation: [leg.start_location.lng, leg.start_location.lat],
    endLocation: [leg.end_location.lng, leg.end_location.lat],
    steps: leg.steps.map(step => ({
      distance: step.distance.value,
      duration: step.duration.value,
      mode: step.travel_mode.toLowerCase(),
      instructions: step.html_instructions,
      transitDetails: step.transit_details ? {
        line: {
          name: step.transit_details.line.name || '',
          shortName: step.transit_details.line.short_name || '',
          color: step.transit_details.line.color || '#1a73e8',
          vehicle: step.transit_details.line.vehicle?.type || 'transit'
        },
        departureStop: step.transit_details.departure_stop.name,
        arrivalStop: step.transit_details.arrival_stop.name,
        departureTime: step.transit_details.departure_time?.text,
        arrivalTime: step.transit_details.arrival_time?.text,
        numStops: step.transit_details.num_stops
      } : null
    })),
    geometry: {
      type: 'LineString',
      coordinates: decodedPath.map(point => [point.lng, point.lat])
    }
  };
}

// Find nearby places
async function findNearbyPlaces(location, type = 'restaurant', radius = 500) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  
  // Format location as lat,lng string
  const locationStr = Array.isArray(location) 
    ? `${location[1]},${location[0]}`
    : location;
  
  url.searchParams.append('location', locationStr);
  url.searchParams.append('radius', radius.toString());
  url.searchParams.append('type', type);
  url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places request failed: ${data.status}`);
  }
  
  if (!data.results || data.results.length === 0) {
    return [];
  }
  
  return data.results.map(place => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity,
    location: [
      place.geometry.location.lng,
      place.geometry.location.lat
    ],
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    types: place.types,
    photos: place.photos
      ? place.photos.map(photo => ({
          reference: photo.photo_reference,
          height: photo.height,
          width: photo.width
        }))
      : []
  }));
}

// Helper function to decode Google's encoded polyline path
function decodePath(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5
    });
  }
  
  return points;
}