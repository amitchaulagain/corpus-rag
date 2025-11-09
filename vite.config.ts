import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['onlyforthedevs.inquisitivemind.tech'],
    hmr: {
      host: 'onlyforthedevs.inquisitivemind.tech',
      protocol: 'wss'
    },
    watch: {
      ignored: ['**/src/lib/prompts/**', '**/data/**']
    }
  }
});