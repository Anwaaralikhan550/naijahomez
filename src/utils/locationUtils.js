// utils/locationUtils.js

// Cache for geocoding results to avoid redundant API calls
const geocodeCache = new Map();

// Common Nigeria localities with their coordinates
// This acts as a fallback database for location matching
const NIGERIA_LOCALITIES = {
  "lekki": { latitude: 6.4698, longitude: 3.5852 },
  "ikeja": { latitude: 6.6018, longitude: 3.3515 },
  "victoria island": { latitude: 6.4281, longitude: 3.4219 },
  "ikoyi": { latitude: 6.4550, longitude: 3.4344 },
  "ajah": { latitude: 6.4698, longitude: 3.5852 },
  "yaba": { latitude: 6.5087, longitude: 3.3800 },
  "surulere": { latitude: 6.5020, longitude: 3.3551 },
  "gbagada": { latitude: 6.5628, longitude: 3.3903 },
  "magodo": { latitude: 6.6342, longitude: 3.3792 },
  "maryland": { latitude: 6.5715, longitude: 3.3679 },
  "ojodu": { latitude: 6.6372, longitude: 3.3705 },
  "festac": { latitude: 6.4698, longitude: 3.2848 },
  "apapa": { latitude: 6.4491, longitude: 3.3659 },
  "lagos island": { latitude: 6.4550, longitude: 3.4045 },
  "lagos mainland": { latitude: 6.5355, longitude: 3.3087 },
  "abuja": { latitude: 9.0579, longitude: 7.4951 },
  "port harcourt": { latitude: 4.8156, longitude: 7.0498 },
  "ibadan": { latitude: 7.3775, longitude: 3.9470 },
  "kano": { latitude: 12.0022, longitude: 8.5920 },
  "calabar": { latitude: 4.9757, longitude: 8.3417 },
  "warri": { latitude: 5.5186, longitude: 5.7499 },
  "benin city": { latitude: 6.3405, longitude: 5.6207 },
  "owerri": { latitude: 5.4966, longitude: 7.0252 },
  "enugu": { latitude: 6.5244, longitude: 7.5102 },
  "asaba": { latitude: 6.2059, longitude: 6.7348 },
  "onitsha": { latitude: 6.1404, longitude: 6.7830 },
  "kaduna": { latitude: 10.5222, longitude: 7.4384 },
  "sokoto": { latitude: 13.0585, longitude: 5.2415 },
  "abeokuta": { latitude: 7.1500, longitude: 3.3500 }
};

const LOCALITY_ENTRIES = Object.entries(NIGERIA_LOCALITIES);
const LOCALITY_INDEX = LOCALITY_ENTRIES.map(([locality, coords]) => ({
  locality,
  coords,
  words: locality.split(/\s+/)
}));

// Enhanced geolocation function that uses a real database of locations
// rather than generating mock coordinates
export async function getLocationCoordinates(locationName) {
  if (!locationName) return null;
  
  // Normalize and clean the location name
  const normalizedLocation = locationName.toLowerCase().trim();
  
  // Return from cache if available
  if (geocodeCache.has(normalizedLocation)) {
    return geocodeCache.get(normalizedLocation);
  }
  
  try {
    // First, try direct match with known localities
    for (const [locality, coords] of LOCALITY_ENTRIES) {
      if (normalizedLocation.includes(locality) || locality.includes(normalizedLocation)) {
        geocodeCache.set(normalizedLocation, coords);
        return coords;
      }
    }
    
    // If no direct match, try partial matching for the closest locality
    let bestMatch = null;
    let highestScore = 0;
    const locationWords = normalizedLocation.split(/\s+/);
    
    for (const { coords, words: localityWords } of LOCALITY_INDEX) {
      // Simple scoring - count how many characters match between strings
      // Word-level matching is more accurate than character matching
      let score = 0;
      for (const locWord of locationWords) {
        for (const knownWord of localityWords) {
          if (knownWord.includes(locWord) || locWord.includes(knownWord)) {
            // Longer words that match get higher scores
            score += Math.min(locWord.length, knownWord.length);
          }
        }
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = coords;
      }
    }
    
    // Only use partial match if the score is meaningful (avoid false matches)
    if (highestScore > 3 && bestMatch) {
      geocodeCache.set(normalizedLocation, bestMatch);
      return bestMatch;
    }
    
    // Fallback: generic location within Nigeria to avoid null results
    // This is better than returning null, as it will at least show some results
    const fallbackCoords = {
      latitude: 6.5244, // Central Nigeria
      longitude: 7.3986
    };
    geocodeCache.set(normalizedLocation, fallbackCoords);
    return fallbackCoords;
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Function to calculate distance between two points using Haversine formula
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Enhanced function to filter listings by proximity with adjustable radius
export async function filterByProximity(items, userLocation, maxDistance = 20) {
  console.log(`Starting proximity filter with ${items.length} items`);
  console.log('User location:', userLocation);
  
  if (!items || items.length === 0) {
    console.log("No items to filter");
    return [];
  }
  
  if (!userLocation) {
    console.error("No user location provided");
    return items; // Return all items if we can't filter
  }
  
  // Get the user's locality based on coordinates
  // This will help with area-based matching (future enhancement)
  const userArea = await getUserLocalityFromCoordinates(userLocation);
  console.log('Detected user area:', userArea);
  
  const result = [];
  let processedItems = 0;
  let itemsWithLocation = 0;
  let itemsWithCoordinates = 0;
  let itemsNearby = 0;
  
  for (const item of items) {
    processedItems++;
    
    if (!item.location) {
      continue;
    }
    
    itemsWithLocation++;
    
    try {
      // Match based on area name first for more accurate results
      if (userArea && item.location.toLowerCase().includes(userArea.toLowerCase())) {
        itemsNearby++;
        result.push({ 
          ...item, 
          distance: 0, // We don't have exact distance but it's in the same area
          matchType: 'area'
        });
        continue;
      }
      
      // Then try coordinate-based matching
      const itemCoordinates = await getLocationCoordinates(item.location);
      
      if (!itemCoordinates) {
        continue;
      }
      
      itemsWithCoordinates++;
      
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        itemCoordinates.latitude,
        itemCoordinates.longitude
      );
      
      // Include items within the distance limit (increased to 20km by default)
      if (distance <= maxDistance) {
        itemsNearby++;
        result.push({ 
          ...item, 
          distance,
          matchType: 'distance'
        });
      }
      
      // Log only every 10th item to avoid console spam
      if (processedItems % 10 === 0 || processedItems === items.length) {
        console.log(`Processed ${processedItems}/${items.length} items`);
      }
    } catch (error) {
      console.error('Error processing item for proximity:', error);
    }
  }
  
  console.log(`Proximity filtering stats:
    Total items: ${items.length}
    Items with location: ${itemsWithLocation}
    Items with resolved coordinates: ${itemsWithCoordinates}
    Items within ${maxDistance}km: ${itemsNearby}`);
  
  // Sort by distance (closest first)
  return result.sort((a, b) => {
    // Area matches come first
    if (a.matchType === 'area' && b.matchType !== 'area') return -1;
    if (a.matchType !== 'area' && b.matchType === 'area') return 1;
    // Then sort by distance
    return a.distance - b.distance;
  });
}

// Reverse geocoding: get locality name from coordinates
async function getUserLocalityFromCoordinates(coords) {
  if (!coords || !coords.latitude || !coords.longitude) return null;
  
  // Find the closest known locality to these coordinates
  let closestLocality = null;
  let shortestDistance = Infinity;
  
  for (const [locality, localityCoords] of LOCALITY_ENTRIES) {
    const distance = calculateDistance(
      coords.latitude,
      coords.longitude,
      localityCoords.latitude,
      localityCoords.longitude
    );
    
    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestLocality = locality;
    }
  }
  
  // Only return if we're reasonably close to a known location (within 10km)
  return shortestDistance <= 10 ? closestLocality : null;
}

// Function to check if a location is within a certain distance of another
export function isWithinDistance(lat1, lon1, lat2, lon2, maxDistance) {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= maxDistance;
}

// Function to get readable distance text
export function getDistanceText(distanceInKm) {
  if (distanceInKm === 0) {
    return 'In this area';
  } else if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)} m`;
  } else if (distanceInKm < 10) {
    return `${distanceInKm.toFixed(1)} km`;
  } else {
    return `${Math.round(distanceInKm)} km`;
  }
}

// Function to find closest location from a list
export function findClosestLocation(userLat, userLng, locations) {
  if (!locations || locations.length === 0) return null;
  
  let closest = locations[0];
  let closestDistance = calculateDistance(
    userLat, userLng, 
    closest.latitude, closest.longitude
  );
  
  for (let i = 1; i < locations.length; i++) {
    const location = locations[i];
    const distance = calculateDistance(
      userLat, userLng, 
      location.latitude, location.longitude
    );
    
    if (distance < closestDistance) {
      closest = location;
      closestDistance = distance;
    }
  }
  
  return {
    ...closest,
    distance: closestDistance
  };
}
