import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'build'
    }),
    alias: {
      '$styles': 'src/styles'
    }
  }
};

export default config;