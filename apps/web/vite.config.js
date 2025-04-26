import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			// Allow serving files from one level up from the project root
			allow: ['..']
		}
	},
	resolve: {
		alias: {
			'$firebase-auth': path.resolve(__dirname, 'src/lib/firebase-auth'),
			'$map': path.resolve(__dirname, 'src/lib/map'),
			'$stores': path.resolve(__dirname, 'src/lib/stores'),
		}
	},
	build: {
		outDir: 'dist',
		// Ensure assets use relative paths
		assetsInlineLimit: 0,
		rollupOptions: {
			output: {
			  manualChunks: {
				'vendor': ['firebase', 'svelte'],
				'maps': ['@googlemaps/js-api-loader'],
				'mobile': [/mobile\/.*\.svelte$/]
			  }
			}
		  }
	}
});
