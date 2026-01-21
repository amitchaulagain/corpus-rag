import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isProduction = process.env.NODE_ENV === 'production';
const externalHost = 'onlyforthedevs.inquisitivemind.tech';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['localhost', externalHost],
    hmr: isProduction ? {
      host: externalHost,
      protocol: 'wss'
    } : true,
    watch: {
      ignored: ['**/src/lib/prompts/**', '**/data/**']
    }
  }
});