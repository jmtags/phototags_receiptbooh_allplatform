import qz from 'qz-tray';
function hostName(value:string) {
  const host=value.trim();
  if(!host || /[\s/:?#@]/.test(host))throw new Error('Enter a hostname or IPv4 address only, without a URL or port.');
  return host;
}
let connectedHost='';
export async function connect(host:string):Promise<string[]> {
  host=hostName(host);
  if(qz.websocket.isActive()&&host!==connectedHost)await qz.websocket.disconnect();
  if(!qz.websocket.isActive()){await qz.websocket.connect({host,usingSecure:true,retries:0});connectedHost=host;}
  const printers=await qz.printers.find();return Array.isArray(printers)?printers:[printers];
}
export async function submit(host:string, printer:string, bytes:Uint8Array) {
  if(!printer || !qz.websocket.isActive() || connectedHost!==host.trim())throw new Error('Reconnect and select a raw printer queue first.');
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  await qz.print(qz.configs.create(printer,{copies:1,encoding:'ISO-8859-1'}),[{type:'raw',format:'command',flavor:'base64',data:btoa(binary)}]);
}
