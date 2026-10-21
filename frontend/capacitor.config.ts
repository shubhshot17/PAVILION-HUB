import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pavilionhub.app',
  appName: 'PAVILION HUB',
  // Vite outputs the built site to frontend/dist
  webDir: 'dist',
  // Allow the app to talk to the dev backend over plain HTTP on a LAN
  server: {
    androidScheme: 'https',
    // Set PAVILION_API_HOST (e.g. 192.168.1.50:3000) to point the app at a
    // backend running on your computer instead of the bundled demo data.
    // hostname: '192.168.1.50:3000' // optional override
  },
};

export default config;
