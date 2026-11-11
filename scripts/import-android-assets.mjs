import {readFile,readdir,copyFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root='C:/codes/Android_PHOTOTAGS/app/src/main/res/drawable-nodpi';
const source=await readFile('C:/codes/Android_PHOTOTAGS/app/src/main/java/com/phototags/MainActivity.kt','utf8');
const labels=new Map([...source.matchAll(/PhotoboothImageStickerOption\("([^"]+)", R\.drawable\.(sticker_[a-z0-9_]+)\)/g)].map(m=>[m[2],m[1]]));
await mkdir('public/stickers',{recursive:true});
const provenance=JSON.parse(await readFile('public/asset-provenance.json','utf8')).filter(p=>!p.file.startsWith('/stickers/')&&!p.file.includes('/receipt_58mm_'));
const category=id=>id.startsWith('sticker_hat_')?'Hats':id.startsWith('sticker_wig_')?'Wigs':id.startsWith('sticker_cute_eye_')?'Eyes & glasses':id.startsWith('sticker_greeting_')?'Greetings':id.startsWith('sticker_mental_')?'Good vibes':'Cute icons';
const categories=['Hats','Cute icons','Eyes & glasses','Wigs','Greetings','Good vibes'];
const catalog=[];let bytes=0;
for(const name of (await readdir(root)).filter(n=>n.startsWith('sticker_')&&/\.(webp|png)$/.test(n))){
  const original=`${root}/${name}`,file=`/stickers/${name}`,id=name.replace(/\.[^.]+$/,'');
  await copyFile(original,'public'+file);const data=await readFile(original),meta=await sharp(data).metadata();bytes+=data.length;
  catalog.push({id,name:labels.get(id)??id.replace(/^sticker_/,'').replaceAll('_',' '),category:category(id),src:file,width:meta.width,height:meta.height});
  provenance.push({file,source:original,transformation:'none',sha256:createHash('sha256').update(data).digest('hex')});
}
catalog.sort((a,b)=>categories.indexOf(a.category)-categories.indexOf(b.category)||a.id.localeCompare(b.id));
for(let count=1;count<=4;count++){
  const name=`receipt_58mm_${count}_${count===1?'shot':'shots'}.png`,file=`/assets/${name}`,original=`${root}/${name}`;
  await copyFile(original,'public'+file);provenance.push({file,source:original,transformation:'none',sha256:createHash('sha256').update(await readFile(original)).digest('hex')});
}
await writeFile('src/stickers.ts',`// Original Android artwork. Regenerate with scripts/import-android-assets.mjs.\nexport const stickerCatalog=${JSON.stringify(catalog,null,2)} as const;\nexport const stickerCategories=${JSON.stringify(categories)} as const;\n`);
await writeFile('public/asset-provenance.json',JSON.stringify(provenance,null,2));
console.log(`Copied ${catalog.length} original stickers (${(bytes/1048576).toFixed(2)} MiB) and four shot-layout previews.`);
