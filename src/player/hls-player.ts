import type { PlayerState } from '../types/index.js';

type PlayerEventMap = {
  'state-change': PlayerState;
  error: Error;
};

type Listener<T> = (value: T) => void;

export interface HLSPlayerOptions {
  hlsUrl: string;
  videoElement: HTMLVideoElement | HTMLAudioElement;
  autoplay?: boolean;
}

export class HLSPlayer {
  private readonly hlsUrl: string;
  private readonly el: HTMLVideoElement | HTMLAudioElement;
  private readonly autoplay: boolean;
  private hls: import('hls.js').default | null = null;
  private _state: PlayerState = 'idle';
  private readonly listeners = new Map<string, Set<Listener<unknown>>>();

  constructor(options: HLSPlayerOptions) {
    this.hlsUrl = options.hlsUrl;
    this.el = options.videoElement;
    this.autoplay = options.autoplay ?? false;
    this.init();
  }

  private async init(): Promise<void> {
    const Hls = (await import('hls.js')).default;

    if (Hls.isSupported()) {
      this.hls = new Hls({ lowLatencyMode: true });
      this.hls.loadSource(this.hlsUrl);
      this.hls.attachMedia(this.el);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.setState('loading');
        if (this.autoplay) this.play();
      });

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.setState('error');
          this.emit('error', new Error(`HLS fatal error: ${data.type}`));
        }
      });

      this.el.addEventListener('playing', () => this.setState('playing'));
      this.el.addEventListener('pause', () => this.setState('paused'));
      this.el.addEventListener('waiting', () => this.setState('loading'));
    } else if (this.el.canPlayType('application/vnd.apple.mpegurl')) {
      this.el.src = this.hlsUrl;
      if (this.autoplay) this.play();
    } else {
      this.setState('error');
      this.emit('error', new Error('HLS is not supported in this browser'));
    }
  }

  play(): void {
    void this.el.play();
  }

  pause(): void {
    this.el.pause();
  }

  destroy(): void {
    this.hls?.destroy();
    this.hls = null;
    this.setState('idle');
  }

  get state(): PlayerState {
    return this._state;
  }

  get latency(): number {
    if (!this.hls) return 0;
    return Math.round(((this.hls as unknown as { latency?: number }).latency ?? 0) * 1000);
  }

  on<K extends keyof PlayerEventMap>(event: K, cb: Listener<PlayerEventMap[K]>): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener<unknown>);
    return this;
  }

  off<K extends keyof PlayerEventMap>(event: K, cb: Listener<PlayerEventMap[K]>): this {
    this.listeners.get(event)?.delete(cb as Listener<unknown>);
    return this;
  }

  private setState(state: PlayerState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit('state-change', state);
  }

  private emit<K extends keyof PlayerEventMap>(event: K, value: PlayerEventMap[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(value));
  }
}
