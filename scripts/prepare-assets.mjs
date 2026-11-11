import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('public/icons',{recursive:true});
const provenance=JSON.parse(await readFile('public/asset-provenance.json','utf8')).filter(p=>!p.file.startsWith('/icons/'));
for(const size of [192,512]){
  const file=`public/icons/icon-${size}.png`;
  await sharp('public/assets/logo-dark.png').extract({left:190,top:80,width:388,height:388}).resize(size,size).png().toFile(file);
  provenance.push({file:`/icons/icon-${size}.png`,source:'C:/codes/Android_PHOTOTAGS_WEBSITE/public/assets/logo-dark.png',transformation:`Camera mark cropped at 190,80,388,388; resized to ${size}px. Original artwork retained.`,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
}
await writeFile('public/asset-provenance.json',JSON.stringify(provenance,null,2));
