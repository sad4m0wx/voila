import 'package:flutter_dotenv/flutter_dotenv.dart';

// Default map settings
const Map<String, double> defaultMapCenter = {
  'lat': 48.8566,
  'lng': 2.3522,  // Paris area center
};

const double defaultMapZoom = 12.0;

// API configuration
final String baseUrl = dotenv.env['API_BASE_URL'] ?? 'https://default.url';

// App configuration
const String appName = 'Voilà!';
const String appTagline = 'Find the perfect place to meet with your friends';

// Cache configuration
const int maxCacheItems = 200;  // Maximum number of cache entries
const Duration cacheTtl = Duration(days: 7);  // Time-to-live for cache entries