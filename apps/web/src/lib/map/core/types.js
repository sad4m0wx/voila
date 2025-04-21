/**
 * @typedef {[number, number]} Coordinates
 * Coordinates in [longitude, latitude] format (GeoJSON standard)
 */

/**
 * @typedef {Object} Address
 * @property {string} formatted - Formatted address string
 * @property {Coordinates} coordinates - Coordinates in [longitude, latitude] format
 * @property {string} [placeId] - Provider-specific place identifier
 */

/**
 * @typedef {Object} Bounds
 * @property {Coordinates} southwest - Southwest corner coordinates
 * @property {Coordinates} northeast - Northeast corner coordinates
 */

/**
 * @typedef {Object} MapOptions
 * @property {Coordinates} center - Center coordinates for the map
 * @property {number} zoom - Initial zoom level
 * @property {boolean} [scrollWheelZoom=true] - Enable/disable scroll wheel zoom
 * @property {boolean} [zoomControl=true] - Show zoom controls
 * @property {boolean} [mapTypeControl=false] - Show map type controls
 */

/**
 * @typedef {Object} Route
 * @property {number} distance - Distance in meters
 * @property {number} duration - Duration in seconds
 * @property {string} startAddress - Starting address
 * @property {string} endAddress - Ending address
 * @property {Coordinates} startLocation - Starting coordinates
 * @property {Coordinates} endLocation - Ending coordinates
 * @property {Array<RouteStep>} steps - Array of route steps
 * @property {RouteGeometry} geometry - Route geometry
 */

/**
 * @typedef {Object} RouteStep
 * @property {number} distance - Distance in meters
 * @property {number} duration - Duration in seconds
 * @property {string} mode - Transportation mode (walking, transit, etc.)
 * @property {string} instructions - Human-readable instructions
 * @property {TransitDetails|null} transitDetails - Transit details if applicable
 */

/**
 * @typedef {Object} TransitDetails
 * @property {TransitLine} line - Transit line information
 * @property {string} departureStop - Departure stop name
 * @property {string} arrivalStop - Arrival stop name
 * @property {string} [departureTime] - Departure time
 * @property {string} [arrivalTime] - Arrival time
 * @property {number} numStops - Number of stops
 */

/**
 * @typedef {Object} TransitLine
 * @property {string} name - Line name
 * @property {string} [shortName] - Short name (if available)
 * @property {string} color - Line color
 * @property {string} vehicle - Vehicle type
 */

/**
 * @typedef {Object} RouteGeometry
 * @property {string} type - Usually "LineString"
 * @property {Array<Coordinates>} coordinates - Array of coordinates defining the route
 */

/**
 * @typedef {Object} Place
 * @property {string} id - Unique identifier
 * @property {string} name - Place name
 * @property {string} address - Place address
 * @property {Coordinates} location - Place coordinates
 * @property {number} [rating] - Rating (if available)
 * @property {number} [userRatingsTotal] - Number of ratings (if available)
 * @property {Array<string>} [types] - Place types
 * @property {Array<PlacePhoto>} [photos] - Place photos (if available)
 */

/**
 * @typedef {Object} PlacePhoto
 * @property {string} reference - Photo reference
 * @property {number} height - Photo height
 * @property {number} width - Photo width
 */

/**
 * @typedef {Object} TransitInfo
 * @property {Array<TransitLine>} transitLines - Array of transit lines
 * @property {string} transitSummary - Human-readable summary of transit route
 */

export * from '.';