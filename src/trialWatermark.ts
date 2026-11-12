export function applyTrialWatermark(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext("2d")!,{width,height}=canvas;
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
  const font=Math.max(8,width*.052);ctx.font=`800 ${font}px sans-serif`;
  ctx.translate(width/2,height/2);ctx.rotate(-Math.PI/10);
  ctx.globalAlpha=.64;ctx.strokeStyle="#fff";ctx.fillStyle="#151515";ctx.lineWidth=Math.max(2,width*.007);
  for(let y=-height;y<=height;y+=Math.max(70,width*.52)){
    ctx.strokeText("PhotoTags Light - FREE TRIAL",0,y,width*.92);ctx.fillText("PhotoTags Light - FREE TRIAL",0,y,width*.92);
  }
  ctx.restore();
  ctx.save();const band=Math.max(18,width*.085);ctx.fillStyle="#fff";ctx.fillRect(0,height-band,width,band);
  ctx.fillStyle="#000";ctx.font=`800 ${Math.max(8,width*.037)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText("PHOTOTAGS LIGHT - FREE TRIAL",width/2,height-band/2,width*.95);ctx.restore();
}
