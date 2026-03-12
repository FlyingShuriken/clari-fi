import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../../theme';

interface LeafletMapProps {
  lat: number;
  lng: number;
  radiusKm: number;
}

function buildHtml(lat: number, lng: number, radiusKm: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0B0B0E; }
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
    map.fitBounds(L.circle([${lat}, ${lng}], ${radiusKm * 1000}).getBounds().pad(0.1));
  <\/script>
</body>
</html>`;
}

export function LeafletMap({ lat, lng, radiusKm }: LeafletMapProps) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: buildHtml(lat, lng, radiusKm) }}
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
