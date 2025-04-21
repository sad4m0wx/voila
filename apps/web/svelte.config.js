import adapterVercel from '@sveltejs/adapter-vercel';
import adapterStatic from '@sveltejs/adapter-static';

const config = { kit: { adapter: adapterStatic() } };

export default config;
