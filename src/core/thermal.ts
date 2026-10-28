export type PressureState = 'nominal' | 'fair' | 'serious' | 'critical';

export function pressureIsHot(state: PressureState | null): boolean {
  return state === 'serious' || state === 'critical';
}

interface PressureRecord {
  source: string;
  state: string;
}

interface PressureObserverHandle {
  observe(source: string): void | Promise<void>;
  disconnect(): void;
}

type PressureObserverCtor = new (cb: (records: PressureRecord[]) => void) => PressureObserverHandle;

export function attachCpuPressure(onChange: (hot: boolean) => void): () => void {
  const Ctor = (globalThis as { PressureObserver?: PressureObserverCtor }).PressureObserver;
  if (typeof Ctor !== 'function') return () => {};
  let last: PressureState | null = null;
  let disposed = false;
  let obs: PressureObserverHandle | undefined;
  const disconnect = () => {
    if (disposed) return;
    disposed = true;
    try { obs?.disconnect(); } catch { /* Unavailable pressure APIs are optional. */ }
  };
  try {
    obs = new Ctor((records) => {
      if (disposed) return;
      for (const rec of records) {
        if (rec.source === 'cpu') last = rec.state as PressureState;
      }
      onChange(pressureIsHot(last));
    });
    Promise.resolve(obs.observe('cpu')).catch(disconnect);
  } catch {
    disconnect();
  }
  return disconnect;
}

/** Android PowerManager: NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN. */
export function thermalBudgetLevel(status: number): number {
  if (!Number.isInteger(status) || status <= 0 || status > 6) return 0;
  return Math.min(status, 5);
}

export interface ThermalStatus { supported: boolean; status: number; }
export interface ThermalStatusBridge {
  getStatus(): Promise<ThermalStatus>;
  addListener(name: 'thermalStatus', callback: (state: ThermalStatus) => void): Promise<{remove(): Promise<void>}>;
}

/** Cleanup also handles late bridge registration and stale initial status replies. */
export function attachThermalStatus(bridge: ThermalStatusBridge, onStatus: (status:number)=>void): ()=>void {
  let disposed=false, generation=0, remove:(()=>Promise<void>)|undefined;
  const changed=(state:ThermalStatus)=>{if(!disposed){generation++;onStatus(state.supported?state.status:0);}};
  void bridge.addListener('thermalStatus',changed).then(handle=>{
    if(disposed){void handle.remove().catch(()=>{});return;}
    remove=()=>handle.remove();
    const version=generation;
    void bridge.getStatus().then(state=>{if(!disposed&&version===generation)changed(state);}).catch(()=>{});
  }).catch(()=>{});
  return ()=>{disposed=true;void remove?.().catch(()=>{});remove=undefined;};
}
