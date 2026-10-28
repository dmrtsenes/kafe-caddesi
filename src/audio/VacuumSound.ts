import { rampTo } from './Synth';

const MOTOR_REAL = new Float32Array(9);
const MOTOR_IMAG = new Float32Array([0, 1, .27, .13, .07, .04, .025, .016, .01]);
const motorWaveCache = new WeakMap<BaseAudioContext, PeriodicWave>();

function getMotorWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = motorWaveCache.get(ctx);
  if (!wave) {
    wave = ctx.createPeriodicWave(MOTOR_REAL, MOTOR_IMAG);
    motorWaveCache.set(ctx, wave);
  }
  return wave;
}

/** Close, steady electric motor + softened airflow; two sources, no reverb or tremolo. */
export class VacuumSound {
  readonly air: AudioBufferSourceNode;
  readonly motor: OscillatorNode;
  private readonly out: GainNode;
  private readonly airGain: GainNode;
  private readonly motorGain: GainNode;
  private readonly airFilter: BiquadFilterNode;
  private readonly nodes: AudioNode[];
  private level = -1;
  private load = -1;
  private retireAt = Infinity;
  private disposed = false;

  constructor(private readonly ctx: BaseAudioContext, noise: AudioBuffer, destination: AudioNode) {
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.air = ctx.createBufferSource(); this.air.buffer = noise; this.air.loop = true;
    const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 180; highpass.Q.value = 0.5;
    this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'lowpass'; this.airFilter.frequency.value = 2400; this.airFilter.Q.value = 0.5;
    this.airGain = ctx.createGain(); this.airGain.gain.value = 0.065;
    this.air.connect(highpass).connect(this.airFilter).connect(this.airGain).connect(this.out);

    this.motor = ctx.createOscillator();
    this.motor.setPeriodicWave(getMotorWave(ctx));
    this.motor.frequency.value = 115;
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0.025;
    this.motor.connect(this.motorGain).connect(this.out);
    this.out.connect(destination);
    this.nodes = [this.air, this.motor, highpass, this.airFilter, this.airGain, this.motorGain, this.out];
    this.air.start(); this.motor.start();
  }

  set(level: number, load: number): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    const changedLevel = Math.abs(level - this.level) > .01;
    const changedLoad = Math.abs(load - this.load) > .03;
    if (!changedLevel && !changedLoad) return;
    if (changedLevel) {
      rampTo(this.out.gain, level, level > 0 ? .24 : .17, now);
      this.retireAt = level > 0 ? Infinity : now + .2;
      this.level = level;
    }
    this.load = load;
    // Airflow opens under load; the motor drops slightly instead of whistling upward.
    rampTo(this.motor.frequency, level > 0 ? 205 - load * 9 : 115, .22, now);
    rampTo(this.airFilter.frequency, 2400 + load * 500, .16, now);
    rampTo(this.airGain.gain, .065 + load * .024, .13, now);
    rampTo(this.motorGain.gain, .025 + load * .003, .16, now);
  }

  get finished(): boolean { return this.ctx.currentTime >= this.retireAt; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.air.stop(); this.motor.stop();
    for (const node of this.nodes) node.disconnect();
    this.air.buffer = null;
  }
}
