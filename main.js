import './style.css'
import L from 'leaflet';

// App state
let map;
let userLocationMarker;
let dropOffMarkers = [];
let dropOffData = [];

// NYC coordinates for fallback
const NYC_CENTER = [40.7831, -73.9712];
const NYC_BOUNDS = [
  [40.4774, -74.2591], // Southwest
  [40.9176, -73.7004]  // Northeast
];

// Initialize the application
async function init() {
  try {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered');
      } catch (swError) {
        console.warn('Service Worker registration failed:', swError);
      }
    }

    // Initialize map
    initializeMap();
    
    // Load data and setup markers
    await loadDropOffData();
    
    // Get user location
    getUserLocation();
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading overlay
    hideLoadingOverlay();
    
    updateConnectionStatus(true);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    updateConnectionStatus(false);
    hideLoadingOverlay();
  }
}

function initializeMap() {
  // Create map centered on NYC
  map = L.map('map', {
    center: NYC_CENTER,
    zoom: 11,
    maxBounds: NYC_BOUNDS,
    maxBoundsViscosity: 1.0
  });

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);
}

async function loadDropOffData() {
  try {
    const response = await fetch('https://data.cityofnewyork.us/resource/if26-z6xq.json');
    dropOffData = await response.json();
    
    console.log(`Loaded ${dropOffData.length} food scrap locations`);
    createMarkers();
    
  } catch (error) {
    console.error('Failed to load data:', error);
    // Try to load from cache if network fails
    try {
      const cachedResponse = await caches.match('https://data.cityofnewyork.us/resource/if26-z6xq.json');
      if (cachedResponse) {
        dropOffData = await cachedResponse.json();
        createMarkers();
        updateConnectionStatus(false);
      }
    } catch (cacheError) {
      console.error('Failed to load cached data:', cacheError);
      showError('Unable to load food scrap locations. Please check your internet connection.');
    }
  }
}

function createMarkers() {
  // Clear existing markers
  dropOffMarkers.forEach(marker => map.removeLayer(marker));
  dropOffMarkers = [];

  const now = new Date();
  
  dropOffData.forEach(location => {
    if (!location.latitude || !location.longitude) return;

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    
    if (isNaN(lat) || isNaN(lng)) return;

    const isOpenNow = checkIfOpenNow(location, now);
    
    // Create custom icon based on availability
    const icon = L.divIcon({
      className: `custom-marker ${isOpenNow ? 'marker-open' : 'marker-closed'}`,
      html: isOpenNow ? '🟢' : '⚫',
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(createPopupContent(location, isOpenNow));

    // Add click event to update info panel
    marker.on('click', () => {
      updateInfoPanel(location, isOpenNow);
    });

    dropOffMarkers.push(marker);
  });
}

function checkIfOpenNow(location, now) {
  // Check if location is open during current month
  if (!isOpenThisMonth(location, now)) {
    return false;
  }
  
  // Check if location is open today and at current time
  return isOpenTodayAndNow(location, now);
}

function isOpenThisMonth(location, now) {
  const openMonths = location.open_months?.toLowerCase() || '';
  
  if (!openMonths) {
    return true; // Assume open year-round if no months specified
  }
  
  const currentMonth = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
  
  // Check if current month is mentioned
  if (openMonths.includes(currentMonth)) {
    return true;
  }
  
  // Check for common patterns like "april through november"
  const throughMatch = openMonths.match(/(\w+)\s+through\s+(\w+)/);
  if (throughMatch) {
    const startMonth = monthNames.indexOf(throughMatch[1]);
    const endMonth = monthNames.indexOf(throughMatch[2]);
    const currentMonthIndex = now.getMonth();
    
    if (startMonth !== -1 && endMonth !== -1) {
      if (startMonth <= endMonth) {
        return currentMonthIndex >= startMonth && currentMonthIndex <= endMonth;
      } else {
        // Wraps around year (e.g., "november through march")
        return currentMonthIndex >= startMonth || currentMonthIndex <= endMonth;
      }
    }
  }
  
  // Check for ranges with dashes like "april-november"
  const dashMatch = openMonths.match(/(\w+)-(\w+)/);
  if (dashMatch) {
    const startMonth = monthNames.indexOf(dashMatch[1]);
    const endMonth = monthNames.indexOf(dashMatch[2]);
    const currentMonthIndex = now.getMonth();
    
    if (startMonth !== -1 && endMonth !== -1) {
      if (startMonth <= endMonth) {
        return currentMonthIndex >= startMonth && currentMonthIndex <= endMonth;
      } else {
        return currentMonthIndex >= startMonth || currentMonthIndex <= endMonth;
      }
    }
  }
  
  return false;
}

function isOpenTodayAndNow(location, now) {
  const operationHours = location.operation_day_hours?.toLowerCase() || '';
  
  if (!operationHours) {
    return true; // Assume open if no hours specified
  }
  
  // Check for 24/7 operation
  if (operationHours.includes('24/7') || operationHours.includes('24 hours')) {
    return true;
  }
  
  const currentDay = now.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format
  
  // Check if today is mentioned in the operation hours
  if (!operationHours.includes(currentDay)) {
    // Check for common day range patterns
    if (operationHours.includes('monday through friday') || operationHours.includes('monday-friday')) {
      const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      if (!weekdays.includes(currentDay)) {
        return false;
      }
    } else if (operationHours.includes('weekends') || operationHours.includes('saturday and sunday')) {
      const weekends = ['saturday', 'sunday'];
      if (!weekends.includes(currentDay)) {
        return false;
      }
    } else if (operationHours.includes('daily') || operationHours.includes('every day')) {
      // Continue to time check
    } else {
      return false; // Day not found and no general patterns matched
    }
  }
  
  // Extract time ranges (e.g., "8:00am-6:00pm", "8am-6pm")
  const timeRangeRegex = /(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)?/gi;
  const timeMatches = [...operationHours.matchAll(timeRangeRegex)];
  
  if (timeMatches.length === 0) {
    return true; // No specific times found, assume open all day
  }
  
  // Check if current time falls within any of the time ranges
  for (const match of timeMatches) {
    const startHour = parseInt(match[1]);
    const startMin = parseInt(match[2] || '0');
    const startPeriod = match[3]?.toLowerCase();
    const endHour = parseInt(match[4]);
    const endMin = parseInt(match[5] || '0');
    const endPeriod = match[6]?.toLowerCase();
    
    // Convert to 24-hour format
    let start24Hour = startHour;
    let end24Hour = endHour;
    
    if (startPeriod === 'pm' && startHour !== 12) {
      start24Hour += 12;
    } else if (startPeriod === 'am' && startHour === 12) {
      start24Hour = 0;
    }
    
    if (endPeriod === 'pm' && endHour !== 12) {
      end24Hour += 12;
    } else if (endPeriod === 'am' && endHour === 12) {
      end24Hour = 0;
    }
    
    const startTime = start24Hour * 100 + startMin;
    const endTime = end24Hour * 100 + endMin;
    
    // Check if current time is within this range
    if (currentTime >= startTime && currentTime <= endTime) {
      return true;
    }
  }
  
  return false; // Current time doesn't fall within any open hours
}

function createPopupContent(location, isOpenNow) {
  const status = isOpenNow ? 
    '<span class="status-open">🟢 Open Now</span>' : 
    '<span class="status-closed">⚫ Closed Now</span>';
  
  return `
    <div class="popup-content">
      <h3>${location.food_scrap_drop_off_site || 'Food Scrap Drop-off'}</h3>
      <p class="status">${status}</p>
      <p class="address"><strong>Address:</strong><br>${location.address || 'Address not available'}</p>
      <p class="hours"><strong>Hours:</strong><br>${location.operation_day_hours || 'Hours not specified'}</p>
      ${location.open_months ? `<p class="months"><strong>Open Months:</strong><br>${location.open_months}</p>` : ''}
      ${location.notes ? `<p class="notes"><strong>Notes:</strong><br>${location.notes}</p>` : ''}
    </div>
  `;
}

function updateInfoPanel(location, isOpenNow) {
  const panel = document.getElementById('infoPanel');
  const status = isOpenNow ? 
    '<span class="status-open">🟢 Open Now</span>' : 
    '<span class="status-closed">⚫ Closed Now</span>';
  
  panel.innerHTML = `
    <h3>${location.food_scrap_drop_off_site || 'Food Scrap Drop-off'}</h3>
    <p class="status">${status}</p>
    <div class="info-details">
      <p><strong>Address:</strong><br>${location.address || 'Address not available'}</p>
      <p><strong>Hours:</strong><br>${location.operation_day_hours || 'Hours not specified'}</p>
      ${location.open_months ? `<p><strong>Open Months:</strong> ${location.open_months}</p>` : ''}
      <p><strong>Borough:</strong> ${location.borough || 'Not specified'}</p>
      ${location.hosted_by ? `<p><strong>Hosted by:</strong> ${location.hosted_by}</p>` : ''}
      ${location.notes ? `<p><strong>Notes:</strong><br>${location.notes}</p>` : ''}
    </div>
  `;
}

function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Remove existing user location marker
        if (userLocationMarker) {
          map.removeLayer(userLocationMarker);
        }
        
        // Add user location marker
        userLocationMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: 'user-location-marker',
            html: '📍',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map).bindPopup('Your Location');
        
        // Center map on user location
        map.setView([latitude, longitude], 13);
      },
      (error) => {
        console.warn('Failed to get user location:', error);
        // Keep default NYC center
      }
    );
  }
}

function setupEventListeners() {
  const centerBtn = document.getElementById('centerOnUser');
  centerBtn.addEventListener('click', getUserLocation);
  
  // Handle online/offline events
  window.addEventListener('online', () => {
    updateConnectionStatus(true);
    loadDropOffData(); // Refresh data when back online
  });
  
  window.addEventListener('offline', () => {
    updateConnectionStatus(false);
  });
}

function updateConnectionStatus(isOnline) {
  const statusEl = document.getElementById('connectionStatus');
  const dot = statusEl.querySelector('.dot');
  const text = statusEl.querySelector('.text');
  
  if (isOnline) {
    dot.className = 'dot online';
    text.textContent = 'Online';
  } else {
    dot.className = 'dot offline';
    text.textContent = 'Offline';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

function showError(message) {
  const infoPanel = document.getElementById('infoPanel');
  infoPanel.innerHTML = `
    <h3>⚠️ Error</h3>
    <p>${message}</p>
    <button onclick="location.reload()" class="retry-btn">Retry</button>
  `;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);