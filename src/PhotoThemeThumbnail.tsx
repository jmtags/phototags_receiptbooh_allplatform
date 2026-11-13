import { artwork, type Template } from "./receipt";

export function PhotoThemeThumbnail({ theme }: { theme: Template }) {
  return <div className="photo-theme-thumbnail" aria-hidden="true"><img src={artwork(theme)} alt=""/>{theme.frames?.map((frame, i) => <span key={i} style={{ left: `${frame.left*100}%`, top: `${frame.top*100}%`, width: `${frame.width*100}%`, height: `${frame.height*100}%` }}>{frame.photo+1}</span>)}</div>;
}
