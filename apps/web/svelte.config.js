import adapterStatic from '@sveltejs/adapter-static';

const adapter = adapterStatic({
  fallback: 'index.html',
  prerender: {
    entries: ['/']
  },
  pages: 'build',
  assets: 'build'
});

const config = {
  kit: {
    adapter,
    paths: {
      base: process.env.BASE_PATH || ''
    }
  }
};

export default config;