import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Node server (../server) runs on port 8787 and serves /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
