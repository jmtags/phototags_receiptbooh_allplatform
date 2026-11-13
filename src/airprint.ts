import { image } from "./receipt";

export const airPrintPapers = {
  photo: { name: "4 × 6 inch photo sheet", size: "4in 6in", width: 1200, height: 1800 },
  a4: { name: "A4 sheet", size: "210mm 297mm", width: 1654, height: 2339 },
  letter: { name: "US Letter sheet", size: "8.5in 11in", width: 1700, height: 2200 },
};
export type AirPrintPaper = keyof typeof airPrintPapers;

export async function photoSheet(source: string, paper: AirPrintPaper, edgeToEdge = false) {
  const img = await image(source), spec = airPrintPapers[paper];
  const canvas = document.createElement("canvas");
  canvas.width = spec.width; canvas.height = spec.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const margin = edgeToEdge && paper === "photo" ? 0 : 36;
  const scale = Math.min((canvas.width - margin * 2) / img.naturalWidth, (canvas.height - margin * 2) / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}

// Only our canvas-generated PNG enters this document. No session/identity data or remote resources.
export function printDocument(png: string, paper: AirPrintPaper, controls = false) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png)) throw new Error("Invalid print image.");
  const [width, height] = airPrintPapers[paper].size.split(" ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PhotoTags LRB print</title><style>
  @page{size:${airPrintPapers[paper].size};margin:0}
  *{box-sizing:border-box}body{margin:0;background:#eee;color:#202330;font:16px system-ui}
  nav{display:${controls ? "block" : "none"};padding:16px;max-width:650px;margin:auto}button{font:inherit;padding:12px 20px;cursor:pointer}
  img{display:block;width:min(100%,600px);height:auto;margin:auto}
  @media print{html,body{margin:0;padding:0;background:white}nav{display:none}img{width:${width};height:${height};max-width:100%;object-fit:contain;break-inside:avoid}}
  </style></head><body><nav><button type="button" id="print" disabled>Print / AirPrint</button><p id="print-status" role="status">Loading your receipt...</p><p>Select your printer and matching paper size. Choose one copy. Return to PhotoTags after printing or cancelling.</p></nav><img alt="PhotoTags receipt fitted to a sheet" src="${png}"><script>
  const picture=document.querySelector('img'),button=document.getElementById('print'),status=document.getElementById('print-status');
  async function prepare(){try{await picture.decode();requestAnimationFrame(()=>requestAnimationFrame(()=>{button.disabled=false;status.textContent='Receipt ready. Tap Print / AirPrint to choose your printer.';}));}catch{status.textContent='The receipt could not load. Return to PhotoTags and review the attempt before retrying.';}}
  button.addEventListener('click',()=>{if(button.disabled)return;button.disabled=true;status.textContent='Print dialog requested. Return to PhotoTags to review this attempt, including after cancelling.';try{window.print();}catch{status.textContent='Printing could not open. Use Safari Share > Print, then return to PhotoTags to review the attempt.';}});
  prepare();
  </script></body></html>`;
}
