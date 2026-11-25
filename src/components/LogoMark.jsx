// Dhun logo mark (generated). Gradient ids are unique per instance.
import { useId } from 'react';
export default function LogoMark({ size = 30 }) {
  const id = useId().replace(/:/g, '');
  const markup = "<defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#22d3ee\"/><stop offset=\".5\" stop-color=\"#8b5cff\"/><stop offset=\"1\" stop-color=\"#ff4d8d\"/></linearGradient></defs><path d=\"M14 38v-6a18 18 0 0 1 36 0v6\" fill=\"none\" stroke=\"url(#g)\" stroke-width=\"4.5\" stroke-linecap=\"round\"/><rect x=\"10\" y=\"36\" width=\"9\" height=\"15\" rx=\"4\" fill=\"url(#g)\"/><rect x=\"45\" y=\"36\" width=\"9\" height=\"15\" rx=\"4\" fill=\"url(#g)\"/><path d=\"M24 44l3-6 3 10 3-14 3 12 3-6\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>".replace(/id="(\w+)"/g, (_, n) => 'id="' + n + id + '"').replace(/url\(#(\w+)\)/g, (_, n) => 'url(#' + n + id + ')');
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
