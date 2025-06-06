import adapterStatic from '@sveltejs/adapter-static';

// Determine which adapter to use, with static being the default for Capacitor
const adapter = adapterStatic({
  // Enable SPA mode with a fallback for client-side routing
  fallback: 'index.html',
  // Only prerender the homepage and other essential static pages
  prerender: {
    entries: ['/']
  },
  // Specify output directory to match Vite config
  pages: 'dist',
  assets: 'dist'
});

const config = {
  kit: {
    adapter,
    // Ensure paths are relative for Capacitor
    paths: {
      base: ''
    }
  }
};

export default config;