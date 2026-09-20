// GeoIP simulation service with realistic coordinates & known proxies

const KNOWN_LOCATIONS = {
  '127.0.0.1': { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, isVpn: false },
  '::1': { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, isVpn: false },
  '103.21.244.0': { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, isVpn: false },
  '103.22.200.15': { city: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090, isVpn: false },
  '198.51.100.42': { city: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060, isVpn: false },
  '185.220.101.5': { city: 'Frankfurt', country: 'Germany', latitude: 50.1109, longitude: 8.6821, isVpn: true }, // Known Tor/VPN exit node
  '45.154.255.89': { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3676, longitude: 4.9041, isVpn: true },
  '194.26.29.112': { city: 'Saint Petersburg', country: 'Russia', latitude: 59.9343, longitude: 30.3351, isVpn: true },
  '18.210.45.19': { city: 'Ashburn', country: 'United States', latitude: 39.0438, longitude: -77.4874, isVpn: true }, // AWS Cloud Hosting IP
  '203.0.113.195': { city: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, isVpn: false },
  '133.242.18.9': { city: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, isVpn: false }
};

/**
 * Resolves IP to geographic details and VPN status.
 * Can be overridden if client provides simulated headers/body for testing.
 */
function resolveGeo(ip, simulatedGeo = null) {
  if (simulatedGeo && (simulatedGeo.city || simulatedGeo.country)) {
    return {
      city: simulatedGeo.city || 'Unknown City',
      country: simulatedGeo.country || 'Unknown Country',
      latitude: simulatedGeo.latitude !== undefined ? Number(simulatedGeo.latitude) : 0,
      longitude: simulatedGeo.longitude !== undefined ? Number(simulatedGeo.longitude) : 0,
      isVpn: Boolean(simulatedGeo.isVpn)
    };
  }

  if (KNOWN_LOCATIONS[ip]) {
    return KNOWN_LOCATIONS[ip];
  }

  // Fallback heuristic based on IP pattern
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip === 'localhost') {
    return { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, isVpn: false };
  }

  return {
    city: 'Bengaluru',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    isVpn: false
  };
}

/**
 * Calculate great-circle distance between two points in kilometers (Haversine formula)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate travel speed in km/h between two timestamped coordinates
 */
function calculateTravelSpeed(loc1, time1, loc2, time2) {
  if (!loc1 || !loc2 || !time1 || !time2) return 0;
  const distanceKm = calculateDistanceKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
  const elapsedMs = Math.abs(new Date(time2).getTime() - new Date(time1).getTime());
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours === 0) {
    return distanceKm > 50 ? 999999 : 0;
  }
  return distanceKm / elapsedHours;
}

module.exports = {
  resolveGeo,
  calculateDistanceKm,
  calculateTravelSpeed,
  KNOWN_LOCATIONS
};
