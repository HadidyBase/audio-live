# @hadidyapp/audio-live

Live streaming SDK for the Hadidy Audio platform. Covers session REST management, LiveKit WebRTC multi-source rooms, HLS playback, and real-time SSE session state.

## Installation

```bash
npm install @hadidyapp/audio-live
```

## Single-source broadcast (OBS → HLS)

```typescript
import { LiveClient, SessionState } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });

const session = await live.sessions.createSession({
  title: 'Friday Night Show',
  recording_enabled: true,
});
await live.sessions.startSession(session.id);

console.log('RTMP URL:', session.ingest_url);
console.log('Stream key:', session.stream_key);

// Real-time listeners via SSE
const state = new SessionState({ sessionId: session.id, apiKey: 'had_live_...' });
state.on('listeners', (count) => console.log(`${count} listeners`));
state.on('now-playing', (track) => console.log('Now playing:', track?.title));
state.subscribe();

// Push track metadata
await live.sessions.updateNowPlaying(session.id, { title: 'Midnight City', artist: 'M83' });
```

## Multi-source WebRTC room

```typescript
import { LiveClient, LiveRoom } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });

const session = await live.sessions.createSession({ mode: 'multi', max_speakers: 4 });
await live.sessions.startSession(session.id);

const source = await live.sessions.addSource(session.id, {
  role: 'speaker',
  display_name: 'Ahmed',
});

const room = new LiveRoom({
  livekitUrl: session.ingest_url,
  participantToken: source.participant_token!,
});
await room.connect();
await room.publishMicrophone();

room.on('participant-joined', (p) => console.log(`${p.identity} joined`));
```

## HLS Listener

```typescript
import { LiveClient, HLSPlayer } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });
const session = await live.sessions.getSession(sessionId);

const player = new HLSPlayer({
  hlsUrl: session.playback_url!,
  videoElement: document.querySelector('audio')!,
  autoplay: true,
});
player.on('state-change', (s) => console.log('Player:', s));
```

## API

| Class | Purpose |
|---|---|
| `LiveClient` | Session REST management (CRUD, start/stop/restart, sources, recordings) |
| `LiveRoom` | WebRTC mic publish/subscribe via livekit-client |
| `HLSPlayer` | HLS manifest playback with hls.js + native Safari fallback |
| `SessionState` | SSE real-time updates (status, now-playing, listener count) |

## License

MIT
