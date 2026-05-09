import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../../theme';

export interface StoreMarker {
  lat: number;
  lng: number;
  label: string;
  isCheapest?: boolean;
}

interface LeafletMapProps {
  lat: number;
  lng: number;
  radiusKm: number;
  markers?: StoreMarker[];
}

function escapeJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function buildHtml(lat: number, lng: number, radiusKm: number, markers: StoreMarker[]): string {
  const markerJs = markers
    .map((m) => {
      const color = m.isCheapest ? '#32D583' : '#6366F1';
      const size = m.isCheapest ? 10 : 7;
      return `L.circleMarker([${m.lat}, ${m.lng}], {
        radius: ${size}, fillColor: '${color}', fillOpacity: 0.9, color: '#fff', weight: 2,
      }).bindTooltip('${escapeJs(m.label)}', { direction: 'top', offset: [0, -${size}], className: 'store-label' })
      .addTo(map);`;
    })
    .join('\n    ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0B0B0E; }
    .store-label {
      background: #1A1A1E !important;
      color: #FAFAF9 !important;
      border: 1px solid #2A2A2E !important;
      border-radius: 6px !important;
      padding: 4px 8px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
    }
    .store-label::before { border-top-color: #2A2A2E !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);
    L.circleMarker([${lat}, ${lng}], {
      radius: 8, fillColor: '#32D583', fillOpacity: 1, color: '#32D583', weight: 2,
    }).addTo(map);
    L.circle([${lat}, ${lng}], {
      radius: ${radiusKm * 1000}, color: '#32D58350', fillColor: '#32D58315', fillOpacity: 0.3, weight: 1,
    }).addTo(map);
    ${markerJs}
    map.fitBounds(L.circle([${lat}, ${lng}], ${radiusKm * 1000}).getBounds().pad(0.1));
  <\/script>
</body>
</html>`;
}

export function LeafletMap({ lat, lng, radiusKm, markers = [] }: LeafletMapProps) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: buildHtml(lat, lng, radiusKm, markers) }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
