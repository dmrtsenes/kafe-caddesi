/** Deterministic positional contact solver. Navigation projects each correction
 * back into walkable space; rendering must use the final corrected positions. */
export interface CrowdBody {
  x: number;
  z: number;
}
export interface SeparationResult {
  contacts: number;
  remaining: number;
}
export function separateCrowd(
  bodies: readonly CrowdBody[],
  project: (body: CrowdBody, fromX: number, fromZ: number) => void,
  diameter = 0.86,
  iterations = 12,
  priority?: CrowdBody,
): SeparationResult {
  let contacts = 0;
  // A queue gives way to the controlled character, with body-sized clearance.
  // Keep normal spacing between NPCs; do not turn busy queues into player walls.
  const spacing = (a: CrowdBody, b: CrowdBody): number =>
    a === priority || b === priority ? Math.min(diameter, 0.7) : diameter;
  for (let pass = 0; pass < iterations; pass++) {
    let changed = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i],
          b = bodies[j];
        const minimum = spacing(a, b), minimumSquared = minimum * minimum;
        const dx = b.x - a.x,
          dz = b.z - a.z;
        const squared = dx * dx + dz * dz;
        if (squared >= minimumSquared - 1e-8) continue;
        const distance = Math.sqrt(squared);
        // Coincident bodies have no normal. A stable pair axis separates them
        // without randomness, NaNs, or the old exact-overlap early return.
        const angle = ((i + 1) * 2.399963 + (j + 1) * 0.618034) % (Math.PI * 2);
        const nx = distance > 1e-6 ? dx / distance : Math.cos(angle);
        const nz = distance > 1e-6 ? dz / distance : Math.sin(angle);
        const push = minimum - distance + 0.00001;
        const weightA = a === priority ? 0 : b === priority ? 1 : .5;
        const weightB = 1 - weightA;
        const ax = a.x, az = a.z, bx = b.x, bz = b.z;
        a.x -= nx * push * weightA;
        a.z -= nz * push * weightA;
        b.x += nx * push * weightB;
        b.z += nz * push * weightB;
        if (weightA) project(a, ax, az);
        if (weightB) project(b, bx, bz);
        contacts++;
        changed = true;
      }
    }
    if (!changed) break;
  }
  let remaining = 0;
  if (contacts > 0) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const min = spacing(a, b) - 0.01;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (dx * dx + dz * dz < min * min) remaining++;
      }
    }
  }
  return { contacts, remaining };
}
