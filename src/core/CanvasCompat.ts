type Radius = number | DOMPointInit;
type CanvasPath = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'ellipse' | 'closePath'>;

/** Canvas roundRect for Android WebViews predating the native path method. */
function roundRect(this: CanvasPath, x: number, y: number, width: number, height: number,
  radii: Radius | Iterable<Radius> = 0): void {
  x = Number(x); y = Number(y); width = Number(width); height = Number(height);
  if (![x, y, width, height].every(Number.isFinite)) return;
  const values: Radius[] = radii != null && typeof radii === 'object' && Symbol.iterator in radii
    ? Array.from(radii as Iterable<Radius>) : [radii as Radius];
  if (values.length < 1 || values.length > 4) throw new RangeError('roundRect requires one to four radii');
  const corners: { x: number; y: number }[] = [];
  for (const value of values) {
    const point = value === null || typeof value === 'object';
    const rx = Number(point ? value?.x ?? 0 : value);
    const ry = Number(point ? value?.y ?? 0 : value);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return;
    if (rx < 0 || ry < 0) throw new RangeError('roundRect radii must be non-negative');
    corners.push({ x: rx, y: ry });
  }
  const [ul, ur = ul, lr = ul, ll = ur] = corners;
  const w = Math.abs(width), h = Math.abs(height);
  const ratio = (size: number, sum: number) => sum === 0 ? Infinity : size / sum;
  const scale = Math.min(1, ratio(w, ul.x + ur.x), ratio(h, ur.y + lr.y),
    ratio(w, lr.x + ll.x), ratio(h, ll.y + ul.y));
  // Scale each distinct input once: shorthand corners may share the same point.
  for (const corner of corners) { corner.x *= scale; corner.y *= scale; }
  const sx = width < 0 ? -1 : 1, sy = height < 0 ? -1 : 1;
  const line = (u: number, v: number) => this.lineTo(x + sx * u, y + sy * v);
  const angle = (a: number) => sy * (sx < 0 ? Math.PI - a : a);
  const arc = (u: number, v: number, radius: { x: number; y: number }, start: number, end: number) =>
    this.ellipse(x + sx * u, y + sy * v, radius.x, radius.y, 0, angle(start), angle(end), sx !== sy);
  this.moveTo(x + sx * ul.x, y);
  line(w - ur.x, 0);
  arc(w - ur.x, ur.y, ur, -Math.PI / 2, 0);
  line(w, h - lr.y);
  arc(w - lr.x, h - lr.y, lr, 0, Math.PI / 2);
  line(ll.x, h);
  arc(ll.x, h - ll.y, ll, Math.PI / 2, Math.PI);
  line(0, ul.y);
  arc(ul.x, ul.y, ul, Math.PI, Math.PI * 1.5);
  this.closePath();
  this.moveTo(x + Math.min(0, width), y + Math.min(0, height));
}

export function installCanvasCompat(): void {
  for (const prototype of [
    typeof CanvasRenderingContext2D === 'undefined' ? undefined : CanvasRenderingContext2D.prototype,
    typeof Path2D === 'undefined' ? undefined : Path2D.prototype,
  ]) {
    if (prototype && typeof prototype.roundRect !== 'function') {
      Object.defineProperty(prototype, 'roundRect', { value: roundRect, writable: true, configurable: true });
    }
  }
}
