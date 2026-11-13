import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function camera(page: Page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error("Viewport kiosk"));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable:true, value:async()=>{
      const c=document.createElement("canvas");c.width=1280;c.height=960;const ctx=c.getContext("2d")!;
      const gradient=ctx.createLinearGradient(0,0,1280,960);gradient.addColorStop(0,"#ff3366");gradient.addColorStop(1,"#22bbee");ctx.fillStyle=gradient;ctx.fillRect(0,0,1280,960);return c.captureStream(15);
    }});
    const delay=window.setTimeout; window.setTimeout=((fn:TimerHandler,ms?:number,...args:any[])=>delay(fn,ms===1000?30:ms,...args)) as typeof setTimeout;
    const encode=HTMLCanvasElement.prototype.toDataURL; let capture=0;
    HTMLCanvasElement.prototype.toDataURL=function(type?:string,quality?:any){
      if(type==="image/jpeg"&&this.width===1280&&this.height===960){const ctx=this.getContext("2d")!;ctx.fillStyle=["#e62f55","#17a76b","#2464dc","#f6c341"][capture++%4];ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,this.width*.12,this.height);}
      return encode.call(this,type,quality);
    };
  });
}
async function settings(page: Page) {
  await page.goto("/");await page.getByRole("button",{name:"Event Theme-PhotoBooth",exact:true}).click();
  await expect(page.getByRole("heading",{name:"PhotoBooth event collection"})).toBeVisible();
}
async function launch(page: Page) {
  await page.getByRole("button",{name:"Launch PhotoBooth",exact:true}).click();
  const kiosk=page.getByRole("dialog",{name:"PhotoTags LRB PhotoBooth kiosk"});await expect(kiosk).toBeVisible();
  await kiosk.getByRole("button",{name:/^(Start|Start a new session)$/}).click();
  await expect(kiosk.getByRole("heading",{name:"Take four photos.",exact:true})).toBeVisible();
  await expect(kiosk.getByRole("heading",{name:"Make it yours.",exact:true})).toBeVisible({timeout:20000});
  await kiosk.getByRole("button",{name:"Back",exact:true}).click();
  await expect(kiosk.locator(".shot-gallery img")).toHaveCount(4);
  await kiosk.getByRole("button",{name:"Continue to themes"}).click();return kiosk;
}

test("PhotoBooth event collection saves separately, selects its default and works offline",async({page,context},info)=>{
  await settings(page);
  await page.getByRole("button",{name:"Event theme-ReceiptBooth",exact:true}).click();
  await page.evaluate(()=>localStorage.setItem("activeEvent","Receipt celebration"));
  await page.getByRole("button",{name:"Event Theme-PhotoBooth",exact:true}).click();
  await page.getByLabel("PhotoBooth event name",{exact:true}).fill("Birthday night");
  await page.getByLabel("PhotoBooth theme name",{exact:true}).fill("Birthday grid");
  await page.getByLabel("PhotoBooth headline",{exact:true}).fill("HAPPY BIRTHDAY");
  await page.getByRole("button",{name:"Save PhotoBooth theme",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"PhotoBooth theme saved"})).toBeVisible();
  await page.getByRole("combobox",{name:"PhotoBooth active event",exact:true}).selectOption("Birthday night");
  const defaultTheme=page.getByRole("combobox",{name:"Default PhotoBooth theme",exact:true});
  await defaultTheme.selectOption({label:"Birthday grid"});
  for(const name of ["Double strip","Story rows","Spotlight grid","Candy pop","Sweet hearts","Party burst"]){await page.locator(".photo-theme-option").filter({has:page.getByText(name,{exact:true})}).getByRole("checkbox").uncheck();}
  await page.locator(".photo-theme-option").filter({has:page.getByText("Birthday grid",{exact:true})}).getByRole("checkbox").click();
  await expect(page.getByRole("alert")).toContainText("Keep at least one");
  expect(await page.evaluate(()=>localStorage.getItem("activeEvent"))).toBe("Receipt celebration");
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:`artifacts/photo-theme-admin-${info.project.name}.png`,fullPage:true});
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();
  await page.getByRole("button",{name:"Event Theme-PhotoBooth",exact:true}).click();
  await expect(defaultTheme).toHaveValue(/event_photo_/);
  await expect(page.getByRole("combobox",{name:"PhotoBooth active event",exact:true})).toHaveValue("Birthday night");
  const stored=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("phototags-event-themes",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise<number>(resolve=>{const r=db.transaction("themes").objectStore("themes").count();r.onsuccess=()=>{db.close();resolve(r.result);};});
  });expect(stored).toBe(0);
  await page.getByRole("button",{name:"Edit Birthday grid",exact:true}).click();
  await page.getByLabel("PhotoBooth headline",{exact:true}).fill("AFTER PARTY");
  await page.getByRole("button",{name:"Save PhotoBooth theme",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"PhotoBooth theme saved"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Edit Birthday grid",exact:true})).toHaveCount(1);
  await page.getByRole("button",{name:"Delete Birthday grid",exact:true}).click();
  await page.getByRole("button",{name:"Confirm delete Birthday grid",exact:true}).click();
  await expect(defaultTheme).toHaveValue("photo_double_strip");
  await page.evaluate(()=>localStorage.setItem("photoBoothActiveEvent","__proto__"));await page.reload();
  await page.getByRole("button",{name:"Event Theme-PhotoBooth",exact:true}).click();
  await expect(defaultTheme).toHaveValue("photo_double_strip");
});

test("four automatic captures lead to photo decoration, sheet printing, download and a fresh guest",async({page,context},info)=>{
  await camera(page);await settings(page);
  await page.getByRole("combobox",{name:"Default PhotoBooth theme",exact:true}).selectOption({label:"Double strip"});
  await page.getByRole("button",{name:"Printer connection",exact:true}).click();
  await page.getByRole("combobox",{name:"Print method",exact:true}).selectOption("airprint");
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);
  const kiosk=await launch(page);
  await expect(kiosk.getByRole("button",{name:"1 shot",exact:true})).toHaveCount(0);
  await expect(kiosk.locator(".photo-drag-handle")).toHaveCount(8);
  await expect(kiosk.getByRole("button",{name:"Double strip",exact:true})).toHaveAttribute("aria-pressed","true");
  const preview=kiosk.getByAltText("Your themed photo preview");await preview.evaluate((img:HTMLImageElement)=>img.decode());
  expect(await preview.evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight])).toEqual([1200,1800]);
  const samples=await preview.evaluate((img:HTMLImageElement)=>{
    const c=document.createElement("canvas");c.width=1200;c.height=1800;const ctx=c.getContext("2d")!;ctx.drawImage(img,0,0);
    return [0,1].map(strip=>[0,1,2,3].map(photo=>Array.from(ctx.getImageData(Math.round((.27+strip*.46)*1200),Math.round((.2075+photo*.19)*1800),1,1).data).slice(0,3)));
  });
  expect(samples[0]).toEqual(samples[1]);
  expect(samples[0].map(rgb=>rgb.indexOf(Math.max(...rgb)))).toEqual([0,1,2,0]);
  const original=await preview.getAttribute("src");
  await kiosk.getByRole("button",{name:"Adjust photo 1",exact:true}).press("+");
  await expect(preview).not.toHaveAttribute("src",original!);
  await expect(kiosk.locator(".photo-drag-handle.selected")).toHaveCount(2);
  await kiosk.getByRole("button",{name:"Spotlight grid",exact:true}).click();
  await expect(kiosk.locator(".photo-drag-handle")).toHaveCount(4);
  expect((await new AxeBuilder({page}).include(".kiosk-dialog").withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:`artifacts/photo-booth-decorate-${info.project.name}.png`});
  await kiosk.getByRole("button",{name:"Review photo",exact:true}).click();
  await expect(kiosk.getByRole("heading",{name:"Your photo sheet is ready.",exact:true})).toBeVisible();
  await expect(kiosk.getByRole("heading",{name:"Scan to keep your photo"})).toHaveCount(0);
  await kiosk.getByRole("button",{name:"Print my photo",exact:true}).click();
  const sheet=page.getByRole("dialog",{name:"Print your photo sheet"});await expect(sheet.getByRole("button",{name:"Print / AirPrint",exact:true})).toBeEnabled();
  const opening=page.waitForEvent("popup");await sheet.getByRole("button",{name:"Print / AirPrint",exact:true}).click();const printable=await opening;
  await expect(printable.getByRole("button",{name:"Print / AirPrint",exact:true})).toBeEnabled();await printable.close();
  await sheet.getByRole("button",{name:"Close AirPrint preview"}).click();
  await expect(kiosk.getByRole("button",{name:"Continue to download",exact:true})).toBeDisabled();
  await kiosk.getByRole("button",{name:"Host: review this print"}).click();await kiosk.getByRole("button",{name:"I checked the printer",exact:true}).click();
  await expect(kiosk.getByRole("heading",{name:"Your photos are ready to download.",exact:true})).toBeVisible();
  const download=page.waitForEvent("download");await kiosk.getByRole("button",{name:"Save photo PNG",exact:true}).click();expect((await download).suggestedFilename()).toContain("photo_spotlight");
  await page.screenshot({path:`artifacts/photo-booth-download-${info.project.name}.png`});
  await kiosk.getByRole("button",{name:"Finish PhotoBooth session",exact:true}).click();
  await expect(kiosk.getByRole("button",{name:"Start",exact:true})).toBeVisible();
  await expect(kiosk.getByRole("button",{name:"Continue my current photo",exact:true})).toHaveCount(0);
  await kiosk.getByRole("button",{name:"Exit kiosk",exact:true}).click();
  await page.getByRole("button",{name:"Launch kiosk",exact:true}).click();
  const receipt=page.getByRole("dialog",{name:"PhotoTags LRB guest kiosk"});await receipt.getByRole("button",{name:"Start",exact:true}).click();
  await expect(receipt.getByRole("heading",{name:"How many shots?",exact:true})).toBeVisible();
});
