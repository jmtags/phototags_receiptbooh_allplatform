declare module 'qz-tray';
declare module 'virtual:pwa-register' { export function registerSW(options?: { onNeedRefresh?:()=>void; onOfflineReady?:()=>void; onRegisterError?:(e:Error)=>void }): (reload?:boolean)=>Promise<void>; }
