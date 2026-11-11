import { registerSW } from 'virtual:pwa-register';
declare const __OFFLINE_INVENTORY__:string;
export const offlineEvents=new EventTarget();
export const updateSW=registerSW({onNeedRefresh:()=>offlineEvents.dispatchEvent(new Event('update')),onOfflineReady:()=>offlineEvents.dispatchEvent(new Event('ready')),onRegisterError:()=>offlineEvents.dispatchEvent(new Event('failure'))});
export async function checkOffline():Promise<string> {
  if(!('serviceWorker' in navigator)||!('caches' in window))return 'Offline storage unavailable. Use HTTPS or localhost.';
  if(!navigator.serviceWorker.controller)return 'Preparing offline files… Recheck after the first load.';
  const names=await caches.keys();const cacheNames=names.filter(n=>n.includes('precache'));
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration?.active)return 'Offline files need preparation. Connect to the internet.';
  const entries:Map<string,Response>=new Map();
  for(const name of cacheNames){const cache=await caches.open(name);for(const key of await cache.keys()){const response=await cache.match(key);if(response?.ok)entries.set(new URL(key.url).pathname,response);}}
  // Audit cached inventory for the running build, even if a newer worker is waiting.
  const files=await entries.get(__OFFLINE_INVENTORY__)?.clone().json();
  if(!Array.isArray(files)||!files.length)return 'Offline file list missing. Reconnect and reload to repair.';
  for(const path of files)if(!entries.has(path))return 'Offline files are missing. Use Repair offline package while online.';
  return 'Ready for offline use';
}
export async function repairOffline(){
  if(!navigator.onLine)throw new Error('Go online before repairing the offline package.');
  // A unique non-ignored query bypasses Workbox's precache route. navigator.onLine
  // alone only confirms a network interface, and cached HTML is not a reachability probe.
  const response=await fetch(`/index.html?phototags-repair=${crypto.randomUUID()}`,{cache:'no-store'}).catch(()=>{throw new Error('The app server is unavailable. Offline files were kept.');});
  if(!response.ok)throw new Error('The app server is unavailable. Offline files were kept.');
  const registration=await navigator.serviceWorker.getRegistration();await registration?.unregister();
  for(const name of await caches.keys())if(name.includes('precache')&&name.includes(location.origin))await caches.delete(name);
  location.reload();
}
