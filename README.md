# NYC Food Scrap Drop-offs PWA

A Progressive Web App for finding food scrap drop-off locations in New York City.

## Running the Application

This application requires **no build tools** or Node.js installation. Simply serve the files with any static HTTP server:

### Using Python
```bash
python -m http.server 8000
# or
python3 -m http.server 8000
```

### Using PHP
```bash
php -S localhost:8000
```

### Using Node.js (optional)
```bash
npx http-server -p 8000
```

Then open your browser to `http://localhost:8000`

## Features

- 🗺️ Interactive map showing NYC food scrap drop-off locations
- 📍 Geolocation support to find nearby drop-offs
- 🟢 Real-time status (open/closed) based on current time
- 💾 PWA with offline support via Service Worker
- 📱 Mobile-friendly responsive design

## Dependencies

- [Leaflet 1.9.4](https://leafletjs.com/) - Loaded from unpkg.com CDN
- No build tools required!

## Data Source

Food scrap drop-off data is fetched from the [NYC Open Data API](https://data.cityofnewyork.us/resource/if26-z6xq.json).

