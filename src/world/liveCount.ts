/** InstancedMesh.count için canlı adet: 0..max, boşsa 0. */
export function clampedLiveCount(max: number, live: number): number {
  if (!(live > 0) || !(max > 0)) return 0;
  return live < max ? live | 0 : max | 0;
}
