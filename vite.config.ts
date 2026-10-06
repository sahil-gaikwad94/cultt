import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4173,
    // The preview proxy reaches this server through a generated host name;
    // allow any host so the sandboxed URL is not rejected.
    allowedHosts: true,
  },
});
