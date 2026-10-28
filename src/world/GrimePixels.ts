/** Preserve exact mask bytes, avoiding a texture upload for subpixel dirt changes. */
export function syncGrimePixels(data: Float32Array, pixels: Uint8Array, width: number, height: number): boolean {
  let changed = false;
  for (let row=0; row<height; row++) {
    const source=(height-1-row)*width, target=row*width*4;
    for (let col=0; col<width; col++) {
      const value=data[source+col] | 0, offset=target+col*4;
      if (pixels[offset] === value) continue;
      pixels[offset]=pixels[offset+1]=pixels[offset+2]=pixels[offset+3]=value;
      changed=true;
    }
  }
  return changed;
}
