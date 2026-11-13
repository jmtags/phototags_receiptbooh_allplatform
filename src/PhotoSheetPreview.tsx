import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";

export function PhotoSheetPreview({ source, onClose, onPrint, printReady }: { source: string; onClose: () => void; onPrint?: () => void; printReady: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const modal = ref.current!; modal.showModal(); return () => modal.close(); }, []);
  return <dialog ref={ref} className="photo-sheet-preview" aria-labelledby="photo-sheet-preview-title" onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
    <header><div><span>PHOTOBOOTH · 4 × 6</span><h2 id="photo-sheet-preview-title">Full-screen photo preview</h2></div><button className="icon-button" aria-label="Close full-screen photo preview" onClick={onClose}><X size={22} aria-hidden="true"/></button></header>
    <div className="photo-sheet-stage"><img src={source} alt="Full 4 by 6 photo sheet, without cropping" width="1200" height="1800"/></div>
    <footer><button className="button button-secondary" onClick={onClose}>Back to session</button>{onPrint && <button className="button button-primary" disabled={!printReady} onClick={onPrint}><Printer size={20} aria-hidden="true"/>Print my photo</button>}</footer>
  </dialog>;
}
