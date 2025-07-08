import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			// Allow serving files from one level up from the project root
			allow: ['..']
		}
	},
	resolve: {
		alias: {
			'$firebase-auth': path.resolve(__dirname, 'src/lib/firebase-auth'),
			'$components': path.resolve(__dirname, 'src/lib/components'),
			'$services': path.resolve(__dirname, 'src/lib/services'),
			'$stores': path.resolve(__dirname, 'src/lib/stores'),
		}
	},
	build: {
		outDir: 'build',
		// Ensure assets use relative paths
		assetsInlineLimit: 0,
		cssCodeSplit: false,

		rollupOptions: {
			output: {
			  manualChunks: undefined 
			  /*{
				'vendor': ['firebase', 'svelte'],
				'maps': ['@googlemaps/js-api-loader'],
				'mobile': [/mobile\/.*\.svelte$/]
			  }*/
			}
		}
	}
});
