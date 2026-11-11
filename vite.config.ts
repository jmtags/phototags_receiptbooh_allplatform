import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readdirSync, writeFileSync } from 'node:fs';
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
const inventoryPath=`/offline-files-${Date.now()}.json`;
export default defineConfig({
  define:{__OFFLINE_INVENTORY__:JSON.stringify(inventoryPath)},
  plugins: [react(), {name:'offline-inventory',writeBundle(){writeFileSync('dist'+inventoryPath,JSON.stringify(walk('dist').map(p=>'/'+p.slice(5)).filter(p=>!p.endsWith('.map')).concat(inventoryPath)));}}, VitePWA({
    registerType: 'prompt', injectRegister: false,
    includeAssets: ['icons/*'],
    manifest: { name: 'PhotoTags Receipt Booth', short_name: 'Receipt Booth', description: 'Capture a moment. Keep the good times.', theme_color: '#f3f3f7', background_color: '#f3f3f7', display: 'standalone', start_url: '/', scope: '/', icons: [{src:'/icons/icon-192.png', sizes:'192x192', type:'image/png'}, {src:'/icons/icon-512.png', sizes:'512x512', type:'image/png'}] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,webp,json,ico,woff2,txt}'], dontCacheBustURLsMatching: /^assets\/.*-[A-Za-z0-9_-]{8}\.(js|css)$/, navigateFallback: '/index.html', cleanupOutdatedCaches: true, skipWaiting: false, clientsClaim: true }
  })]
});
