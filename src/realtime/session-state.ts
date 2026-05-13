import type { NowPlayingInfo } from '@hadidyapp/audio-sdk';

type EventMap = {
  status: string;
  'now-playing': NowPlayingInfo | null;
  listeners: number;
  error: Error;
};

type Listener<T> = (value: T) => void;

export class SessionState {
  private readonly sessionId: string;
  private readonly apiKey: string;
  private readonly sseToken: string | undefined;
  private readonly baseUrl: string;
  private eventSource: EventSource | null = null;
  private readonly listeners = new Map<string, Set<Listener<unknown>>>();

  /**
   * @param options.apiKey    - Your Hadidy API key (used as fallback if sseToken is not provided).
   * @param options.sseToken  - Recommended: a short-lived SSE-scoped token obtained from
   *                            `POST /api/v1/live/sessions/{id}/sse-token`. Using this avoids
   *                            placing your long-lived API key in the URL query string where it
   *                            can appear in server logs and browser history.
   */
  constructor(options: { sessionId: string; apiKey: string; sseToken?: string; baseUrl?: string }) {
    this.sessionId = options.sessionId;
    this.apiKey = options.apiKey;
    this.sseToken = options.sseToken;
    this.baseUrl = options.baseUrl ?? 'https://api.hadidy.com';
  }

  subscribe(): void {
    if (this.eventSource) return;

    const url = new URL(
      `/api/v1/live/sessions/${encodeURIComponent(this.sessionId)}/events`,
      this.baseUrl,
    );
    // Prefer the short-lived sseToken; fall back to apiKey with a console warning.
    if (this.sseToken) {
      url.searchParams.set('token', this.sseToken);
    } else {
      console.warn(
        '[hadidy-audio-live] SessionState: Using apiKey as SSE token. ' +
        'For production use, obtain a short-lived token via POST /api/v1/live/sessions/{id}/sse-token ' +
        'and pass it as `sseToken` to avoid exposing your API key in URL logs.',
      );
      url.searchParams.set('token', this.apiKey);
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.addEventListener('status', (e) => {
      this.emit('status', (e as MessageEvent).data as string);
    });

    this.eventSource.addEventListener('now-playing', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data as string) as NowPlayingInfo | null;
        this.emit('now-playing', data);
      } catch {
        this.emit('now-playing', null);
      }
    });

    this.eventSource.addEventListener('listeners', (e) => {
      this.emit('listeners', parseInt((e as MessageEvent).data as string, 10));
    });

    this.eventSource.onerror = () => {
      this.emit('error', new Error('SSE connection error'));
    };
  }

  unsubscribe(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  on<K extends keyof EventMap>(event: K, cb: Listener<EventMap[K]>): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener<unknown>);
    return this;
  }

  off<K extends keyof EventMap>(event: K, cb: Listener<EventMap[K]>): this {
    this.listeners.get(event)?.delete(cb as Listener<unknown>);
    return this;
  }

  private emit<K extends keyof EventMap>(event: K, value: EventMap[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(value));
  }
}
