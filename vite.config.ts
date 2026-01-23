import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // This ensures environment variables are available to the server
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
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
  };
});