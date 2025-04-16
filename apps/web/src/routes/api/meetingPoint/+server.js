// src/routes/api/meetingPoint/+server.js
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    // Get addresses from request
    const { addresses, meetingPoint } = await request.json();
    
    // If the client already calculated everything, just log and return
    if (meetingPoint) {
      // You could save the meeting point to a database here
      console.log('Meeting point received:', meetingPoint);
      return json(meetingPoint);
    }
    
    // This is now just a fallback in case something went wrong on the client side
    // The main algorithm should be running client-side
    return json({
      name: "Simple Meeting Point",
      coordinates: findCentroid(addresses.map(addr => addr.coordinates)),
      travelTimes: addresses.map(addr => ({
        id: addr.id,
        address: addr.value,
        duration: 10, // Placeholder duration
        estimated: true
      }))
    });
  } catch (error) {
    console.error('API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process meeting point', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Find the geometric center of multiple coordinates
 */
function findCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return [0, 0]; // Default fallback
  }
  
  const n = coordinates.length;
  
  // Sum all coordinates
  const sum = coordinates.reduce(
    (acc, coord) => {
      return [acc[0] + coord[0], acc[1] + coord[1]];
    },
    [0, 0]
  );
  
  // Divide by number of points to get average
  return [sum[0] / n, sum[1] / n];
}