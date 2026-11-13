import { useEffect, useState } from "react";
import { compose, defaultPlacement, type Template } from "./receipt";
import { newDesign, type EventTheme } from "./eventThemes";
import { createPhotoBoothArtwork, photoFrames, type PhotoLayoutName } from "./photoBoothThemes";
import { PhotoThemeThumbnail } from "./PhotoThemeThumbnail";
import type { BoothModel } from "./useBooth";
import "./photobooth.css";

export function PhotoBoothThemeSettings({ booth: b }: { booth: BoothModel }) {
  const library = b.photoThemes, locked = b.busy || !!b.job || library.themesLoading;
  const [id, setId] = useState(""), [name, setName] = useState("My photo theme"), [event, setEvent] = useState(library.activeEvent);
  const [headline, setHeadline] = useState("GOOD TIMES"), [footer, setFooter] = useState("A moment to keep");
  const [background, setBackground] = useState("#ffffff"), [ink, setInk] = useState("#15233b"), [upload, setUpload] = useState("");
  const [layout, setLayout] = useState<PhotoLayoutName>("grid"), [frames, setFrames] = useState(photoFrames("grid"));
  const [preview, setPreview] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState("");
  useEffect(() => {
    let active = true;
    setMessage("");
    createPhotoBoothArtwork(event, headline, footer, background, ink, upload).then(artwork => compose({ id: "photo_preview", name, description: "", area: [0,0,1,1], artwork, frames }, null, "deli", 1, false, "portrait", { photos: Array(4).fill(null), placements: Array.from({length:4}, defaultPlacement), shotCount:4, stickers:[], strokes:[] }, 480)).then(c => { if (active) setPreview(c.toDataURL("image/png")); }).catch(() => { if (active) setError("Could not prepare the theme preview."); });
    return () => { active = false; };
  }, [name, event, headline, footer, background, ink, upload, frames]);
  function attempt(fn: () => void) { try { fn(); setError(""); } catch (e) { setError((e as Error).message); } }
  function fresh() { setId(""); setName("My photo theme"); setEvent(library.activeEvent); setHeadline("GOOD TIMES"); setFooter("A moment to keep"); setBackground("#ffffff"); setInk("#15233b"); setUpload(""); setLayout("grid"); setFrames(photoFrames("grid")); setError(""); setMessage(""); }
  function edit(theme: EventTheme) { setId(theme.id); setName(theme.name); setEvent(theme.event); setHeadline(theme.design.headline); setFooter(theme.design.footer); setBackground(theme.photoDesign?.background || "#ffffff"); setInk(theme.photoDesign?.ink || "#15233b"); setLayout(theme.photoDesign?.layout || "grid"); setFrames(theme.frames || photoFrames("grid")); setUpload(theme.design.upload); setMessage(""); }
  async function save() {
    if (locked || saving) return;
    if (!name.trim() || !event.trim()) { setError("Enter an event name and theme name."); return; }
    setSaving(true); setError("");
    try {
      const artwork = await createPhotoBoothArtwork(event.trim(), headline, footer, background, ink, upload);
      const theme: EventTheme = { id: id || `event_photo_${crypto.randomUUID()}`, name: name.trim(), event: event.trim(), description: "Four-photo event keepsake", artwork, area:[0,0,1,1], frames, design:{...newDesign(), headline, footer, upload}, photoDesign:{background,ink,layout}, updatedAt:new Date().toISOString() };
      await library.saveEventTheme(theme); setId(theme.id); setMessage("PhotoBooth theme saved on this device. Select its event above to use it.");
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  async function loadBackground(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20*1024*1024) { setError("Choose a PNG, JPEG or WebP under 20 MB."); return; }
    setSaving(true);
    try { const data = await new Promise<string>((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error("Could not read this background.")); reader.readAsDataURL(file); }); setUpload(data); setError(""); } catch(e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <div className="photo-theme-settings">
    <section className="host-panel"><h2>PhotoBooth event collection</h2><p>Four automatic photos, then a photo layout, decoration, printing and download QR. These themes are separate from ReceiptBooth.</p>
      <div className="form-grid"><label className="field">PhotoBooth active event<select disabled={locked || saving} value={library.activeEvent} onChange={e=>attempt(()=>library.setActiveEvent(e.target.value))}><option value="">All events</option>{[...new Set([...library.eventThemes.map(t=>t.event), ...(library.activeEvent?[library.activeEvent]:[])])].sort().map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="field">Default PhotoBooth theme<select disabled={locked || saving} value={library.defaultTheme.id} onChange={e=>attempt(()=>library.setDefault(e.target.value))}>{library.availableThemes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
      <div className="photo-theme-collection">{library.themes.map(theme=><label key={theme.id} className="photo-theme-option"><PhotoThemeThumbnail theme={theme}/><strong>{theme.name}</strong><span>{theme.event || "Built-in"}</span><span><input type="checkbox" checked={library.availableThemes.some(t=>t.id===theme.id)} disabled={locked || saving} onChange={e=>attempt(()=>library.setVisible(theme.id,e.target.checked))}/> Show in PhotoBooth</span></label>)}</div>
    </section>
    {(error || library.themeError) && <p className="alert" role="alert">{error || library.themeError}</p>}{message && <p role="status">{message}</p>}
    <section className="host-panel"><h2>{id ? "Edit PhotoBooth theme" : "Create PhotoBooth event theme"}</h2><p>Portrait 4 × 6 sheet with four photos. Upload your event artwork and place each photo frame.</p>
      <div className="photo-theme-designer"><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={locked || saving}>
        <div className="form-grid"><label className="field">PhotoBooth event name<input value={event} maxLength={80} onChange={e=>setEvent(e.target.value)}/></label><label className="field">PhotoBooth theme name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
        <label className="field">PhotoBooth headline<input value={headline} maxLength={80} onChange={e=>setHeadline(e.target.value)}/></label><label className="field">PhotoBooth footer<input value={footer} maxLength={120} onChange={e=>setFooter(e.target.value)}/></label>
        <label className="field">Photo layout<select value={layout} onChange={e=>{const value=e.target.value as PhotoLayoutName;setLayout(value);setFrames(photoFrames(value));}}><option value="grid">Spotlight grid · four photos</option><option value="double">Double strip · two copies of four photos</option><option value="rows">Story rows · four photos</option></select></label>
        <label className="field">PhotoBooth background color<input type="color" value={background} onChange={e=>setBackground(e.target.value)}/></label><label className="field">PhotoBooth text color<input type="color" value={ink} onChange={e=>setInk(e.target.value)}/></label>
        <label className="field">PhotoBooth background image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void loadBackground(e.target.files?.[0])}/></label></div>
        {upload && <button type="button" className="button button-quiet" onClick={()=>setUpload("")}>Remove PhotoBooth background</button>}
        <details><summary>Adjust photo frames</summary><p>Positions and sizes are percentages of the sheet. All four photos must remain visible.</p>{frames.map((frame,index)=><div className="photo-frame-fields" key={index}><strong>Photo {frame.photo+1}{index>=4 ? " copy 2" : ""}</strong>{(["left","top","width","height"] as const).map(key=><label key={key}>{key}<input type="number" min={key==="left"||key==="top"?0:5} max="100" step="0.5" value={Math.round(frame[key]*1000)/10} aria-label={`Frame ${index+1} ${key} percent`} onChange={e=>setFrames(current=>current.map((f,i)=>i===index?{...f,[key]:Math.max(0,Math.min(100,Number(e.target.value)))/100}:f))}/></label>)}</div>)}</details>
        <div className="test-buttons"><button className="button button-primary" type="submit">{saving?"Saving...":"Save PhotoBooth theme"}</button><button className="button button-secondary" type="button" onClick={fresh}>New PhotoBooth theme</button></div>
      </fieldset></form><div className="photo-theme-live-preview">{preview && <img src={preview} alt="PhotoBooth event theme preview"/>}</div></div>
    </section>
    <section className="host-panel"><h2>Saved PhotoBooth event themes</h2>{!library.eventThemes.length && <p>No custom PhotoBooth themes yet.</p>}{library.eventThemes.map(theme=><div className="photo-theme-saved" key={theme.id}><div><strong>{theme.name}</strong><p>{theme.event}</p></div><button className="button button-secondary" disabled={locked || saving} onClick={()=>edit(theme)}>Edit {theme.name}</button>{deleting===theme.id?<><button className="button button-secondary" disabled={locked || saving} onClick={()=>{setSaving(true);void library.deleteEventTheme(theme.id).then(()=>{if(id===theme.id)fresh();setDeleting("");}).catch(e=>setError(e.message)).finally(()=>setSaving(false));}}>Confirm delete {theme.name}</button><button className="button button-quiet" onClick={()=>setDeleting("")}>Cancel delete</button></>:<button className="button button-quiet" disabled={locked || saving} onClick={()=>setDeleting(theme.id)}>Delete {theme.name}</button>}</div>)}</section>
  </div>;
}
