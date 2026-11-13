import { artwork, templates } from "./receipt";

// Reuse the booth's bundled, original sample portraits. No guest photos or remote assets.
export function PhotoWelcomeSamples() {
  const samples = [templates[0], templates[1], templates[4]];
  // Tighter portrait crops omit the receipt's headlines and frame borders.
  const crops = [[.30, .37, .82, .68], [.12, .18, .88, .54], [.09, .255, .91, .73]];
  return <div className="photo-welcome-samples" aria-hidden="true">
    {["A NIGHT TO REMEMBER", "GOOD TIMES, TOGETHER", "YOUR MOMENT"].map((title, card) => <div className={`photo-sample-card photo-sample-card-${card}`} key={title}>
      <strong>{title}</strong>
      <div className="photo-sample-grid">{[0, 1, 2, 3].map((shot) => {
        const index = (shot + card) % samples.length, template = samples[index], [left, top, right, bottom] = crops[index];
        return <span className="photo-sample-shot" key={shot} style={{ backgroundImage: `url("${artwork(template)}")`, backgroundSize: `${100 / (right - left)}% ${100 / (bottom - top)}%`, backgroundPosition: `${100 * left / (1 - right + left)}% ${100 * top / (1 - bottom + top)}%` }}/>;
      })}</div>
      <span>FOUR MOMENTS. ONE MEMORY.</span><small>PHOTOTAGS LRB · 4 × 6</small>
    </div>)}
  </div>;
}
