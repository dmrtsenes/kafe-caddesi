/** Film acceptance uses rendered roots, not just simulation coordinates. */
export interface TrafficActor {
  id: string;
  staff: boolean;
  x: number;
  z: number;
  renderedX: number;
  renderedZ: number;
}
export class TrafficAudit {
  samples = 0;
  staffTravel = 0;
  private previousStaff = new Map<string, { x: number; z: number }>();
  minStaffDistance = Infinity;
  minMovingDistance = Infinity;
  maxTransformError = 0;
  overlaps = 0;
  readonly examples: {
    time: number;
    a: string;
    b: string;
    distance: number;
  }[] = [];
  sample(time: number, actors: readonly TrafficActor[]): void {
    this.samples++;
    for (const a of actors)
      if (a.staff) {
        const old = this.previousStaff.get(a.id);
        if (old) this.staffTravel += Math.hypot(a.x - old.x, a.z - old.z);
        this.previousStaff.set(a.id, { x: a.x, z: a.z });
      }
    for (const a of actors)
      this.maxTransformError = Math.max(
        this.maxTransformError,
        Math.hypot(a.x - a.renderedX, a.z - a.renderedZ),
      );
    for (let i = 0; i < actors.length; i++)
      for (let j = i + 1; j < actors.length; j++) {
        const a = actors[i],
          b = actors[j];
        const distance = Math.hypot(
          a.renderedX - b.renderedX,
          a.renderedZ - b.renderedZ,
        );
        this.minMovingDistance = Math.min(this.minMovingDistance, distance);
        if (a.staff && b.staff)
          this.minStaffDistance = Math.min(this.minStaffDistance, distance);
        if (distance < 0.8) {
          this.overlaps++;
          if (this.examples.length < 12)
            this.examples.push({ time, a: a.id, b: b.id, distance });
        }
      }
  }
  report() {
    return {
      samples: this.samples,
      staffTravel: this.staffTravel,
      minStaffDistance: this.minStaffDistance,
      minMovingDistance: this.minMovingDistance,
      maxTransformError: this.maxTransformError,
      overlaps: this.overlaps,
      examples: this.examples,
    };
  }
}
