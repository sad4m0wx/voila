import { CORE_API_URL } from '../config';

const DEBUG = false;

export async function findOptimalMeetingPoint(
  addressesWithCoordinates,
  options = {}
) {

  const { 
    transportation_mode = 'transit',
    venue_types = ['restaurant'],
    search_radius = 500,
    showVenues = true
  } = options;

  if (!addressesWithCoordinates || addressesWithCoordinates.length < 2) {
    throw new Error('At least 2 addresses are required');
  }

  try {
    const requestBody = {
      addresses: addressesWithCoordinates.map(addr => ({
        id: String(addr.id),
        address: addr.value,
        coordinates: addr.coordinates ? [addr.coordinates[0], addr.coordinates[1]] : null
      }))
    };

    const response = await fetch(`${CORE_API_URL}/api/meeting-point`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText || 'Failed to calculate meeting point'}`);
    }

    const rustResponse = await response.json();

    // Handle the new multiple meeting points structure
    const meetingPoints = rustResponse.meeting_points || [];
    const allRoutes = rustResponse.routes || [];

    if (!meetingPoints.length) {
      throw new Error('No meeting points returned from API');
    }

    // Use the first meeting point as the primary one
    const primaryMeetingPoint = meetingPoints[0];
    const primaryRoutes = allRoutes[0] || [];

    // Process routes to ensure step details are preserved
    const processRoutes = (routes) => {
      return routes.map((route, routeIndex) => {
        if (route.steps && route.steps.length > 0) {
          // Process each step to ensure transit_details are preserved
          const processedSteps = route.steps.map(step => ({
            ...step,
            mode: step.mode || step.travel_mode,
            geometry: step.geometry,
            transit_details: step.transit_details ? {
              ...step.transit_details,
              line: step.transit_details.line ? {
                ...step.transit_details.line,
                color: step.transit_details.line.color || null,
                vehicle_type: step.transit_details.line.vehicle_type || step.transit_details.line.vehicle?.type || null
              } : null
            } : null
          }));

          return {
            id: route.id || `route-${routeIndex}`,
            geometry: route.geometry,
            steps: processedSteps,
            color: route.color || getRouteColor(routeIndex),
            weight: 5,
            opacity: 0.8
          };
        } else {
          // Fallback to main route geometry if no steps
          return {
            id: route.id || `route-${routeIndex}`,
            geometry: route.geometry,
            steps: [],
            color: route.color || getRouteColor(routeIndex),
            weight: 5,
            opacity: 0.8
          };
        }
      });
    };

    return {
      name: primaryMeetingPoint.name,
      coordinates: primaryMeetingPoint.coordinates,
      travelTimes: primaryMeetingPoint.travel_times.map(tt => {
        let durationInMinutes = 0;
        
        if (tt.duration !== undefined && tt.duration !== null) {
          if (typeof tt.duration === 'object' && tt.duration.value !== undefined) {
            durationInMinutes = tt.duration.unit === 'seconds' ? 
              Math.round(tt.duration.value / 60) : tt.duration.value;
          } else if (typeof tt.duration === 'string') {
            durationInMinutes = parseInt(tt.duration) || 0;
          } else if (typeof tt.duration === 'number') {
            durationInMinutes = tt.duration;
          }
        }
        
        // Ensure duration is reasonable
        if (!durationInMinutes || durationInMinutes < 0 || durationInMinutes > 120) {
          durationInMinutes = 0;
        }
        
        return {
          id: tt.id,
          address: tt.address,
          duration: durationInMinutes,
          distance: tt.distance,
          estimated: tt.estimated || false,
          transitSummary: tt.transit_summary
        };
      }),
      routes: processRoutes(primaryRoutes),
      venues: rustResponse.venues || [],
      debug: rustResponse.debug_data || null,
      allMeetingPoints: meetingPoints.map((mp, mpIndex) => ({
        name: mp.name,
        coordinates: mp.coordinates,
        travelTimes: mp.travel_times.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: typeof tt.duration === 'number' ? tt.duration : parseInt(tt.duration) || 0,
          distance: tt.distance,
          estimated: tt.estimated || false,
          transitSummary: tt.transit_summary
        })),
        routes: processRoutes(allRoutes[mpIndex] || [])
      })),
      allRoutes: allRoutes.map(routeSet => processRoutes(routeSet))
    };

  } catch (apiError) {
    console.error('Error from Rust API:', apiError);
    
    // Fallback to simple centroid calculation
    return {
      name: "Simple Meeting Point",
      coordinates: findCentroid(addressesWithCoordinates.map(addr => addr.coordinates)),
      travelTimes: addressesWithCoordinates.map(addr => ({
        id: addr.id,
        address: addr.value,
        duration: 10,
        estimated: true
      })),
      routes: [],
      venues: [],
      debug: null
    };
  }
}

function getRouteColor(index) {
  // Use gradient colors for routes
  const colors = ['#3b82f6', '#dc2626', '#059669', '#f59e0b', '#8b5cf6'];
  return colors[index % colors.length];
}

function findCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return [0, 0];
  }
  
  const n = coordinates.length;
  const sum = coordinates.reduce(
    (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
    [0, 0]
  );
  
  return [sum[0] / n, sum[1] / n];
}