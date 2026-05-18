# @hadidyapp/audio-live

Live streaming SDK for the [Hadidy Audio](https://hadidy.com) platform. Covers session management, WHIP/RTMPS encoder setup, LiveKit WebRTC multi-source rooms, HLS/WHEP playback, and real-time SSE session state.

## Installation

```bash
npm install @hadidyapp/audio-live
```

> **Dependencies:** `hls.js` and `livekit-client` are bundled — no separate install needed. Requires `@hadidyapp/audio-sdk ^0.1.2` (installed automatically as a peer dependency).

---

## Single-source broadcast — WHIP (OBS 30+ / Larix)

WHIP is the recommended protocol. The full ingest URL (including stream key) is returned by the API — paste it directly into your encoder.

```typescript
import { LiveClient, SessionState } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });

const session = await live.sessions.createSession({
  title: 'Friday Night Show',
  ingest_protocol: 'whip',   // default; can be omitted
  recording_enabled: true,
});
await live.sessions.startSession(session.id);

console.log('WHIP endpoint:', session.ingest_url);
// → https://ingest.hadidy.com/{stream_key}/whip

// OBS 30+: Settings → Stream → Service: WHIP
//   Server: paste session.ingest_url  (no separate stream key field)
// Larix Broadcaster: tap +, pick WHIP, paste session.ingest_url
```

---

## Single-source broadcast — RTMPS (OBS older / vMix / Streamlabs)

For encoders that don't support WHIP, use RTMPS. The server address and stream key are separate fields.

```typescript
const session = await live.sessions.createSession({
  title: 'Friday Night Show',
  ingest_protocol: 'rtmp',   // TLS-encrypted on port 4936 externally
  recording_enabled: true,
});
await live.sessions.startSession(session.id);

console.log('RTMPS server:', session.ingest_url);  // rtmps://rtmps.hadidy.com:4936/
console.log('Stream key:  ', session.stream_key);

// OBS (any version): Settings → Stream → Service: Custom
//   Server:     paste session.ingest_url  (rtmps://…)
//   Stream Key: paste session.stream_key
//
// vMix / Streamlabs: use the same server + key fields
```

---

## Track metadata — push current track to listeners

Call `updateNowPlaying` whenever the track changes. Also push the upcoming track so listeners' players can preload the cover art before the transition.

```typescript
// On track change in your DJ app:
await live.sessions.updateNowPlaying(session.id, {
  title: 'Midnight City',
  artist: 'M83',
  album: 'Hurry Up, We\'re Dreaming',
  cover_url: 'https://i.ytimg.com/vi/dX3k_QDnzHE/maxresdefault.jpg',

  // Optional: preload next track on listeners' devices
  next_title: 'Resonance',
  next_artist: 'Home',
  next_cover_url: 'https://example.com/next-cover.jpg',
});

// Clear track info (e.g. between sets)
await live.sessions.clearNowPlaying(session.id);
```

> **Note on `cover_url`:** must be a valid `https://` URL. YouTube thumbnail URLs are accepted only when the video ID is a real 11-character YouTube ID — local file paths passed as video IDs are rejected automatically.

---

## Real-time session state (SSE)

Subscribe to live updates pushed from the server — no polling needed.

```typescript
import { SessionState } from '@hadidyapp/audio-live';

const state = new SessionState({ sessionId: session.id, apiKey: 'had_live_...' });

state.on('status',      (s) => console.log('Stream status:', s));       // 'live' | 'stopped' | …
state.on('listeners',   (n) => console.log(`${n} listeners`));
state.on('now-playing', (track) => {
  if (track) console.log(`▶ ${track.artist} — ${track.title}`);
  else       console.log('No track info');
});
state.on('next-track',  (track) => {
  // Fires when the DJ pushes next_title/next_cover_url.
  // Use this to preload the cover image before the transition:
  if (track?.cover_url) {
    const img = new Image();
    img.src = track.cover_url;   // warms browser cache
  }
});
state.on('error',       (err) => console.error('SSE error:', err));

state.subscribe();

// When done
state.unsubscribe();
```

| Event | Payload | When |
|---|---|---|
| `status` | `string` | Session state changes (`created`, `live`, `stopped`, …) |
| `listeners` | `number` | Listener count updates |
| `now-playing` | `NowPlayingInfo \| null` | DJ pushes a track change |
| `next-track` | `{ title, artist, cover_url } \| null` | DJ pushes upcoming track |
| `error` | `Error` | SSE connection error |

---

## HLS Listener

Stream playback via LL-HLS (Low-Latency HLS). Latency is ~4–5 seconds end-to-end.

```typescript
import { LiveClient, HLSPlayer } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });
const session = await live.sessions.getSession(sessionId);

const player = new HLSPlayer({
  hlsUrl: session.playback_url!,         // https://live.hadidy.com/{key}/index.m3u8
  videoElement: document.querySelector('audio')!,
  autoplay: true,
});

player.on('state-change', (state) => console.log('Player:', state));
// states: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
```

> **Sub-500ms latency (WebRTC):** use the WHEP endpoint instead of HLS for near-real-time playback with no buffering:
> ```
> https://ingest.hadidy.com/{stream_key}/whep
> ```
> Pass this URL to an `RTCPeerConnection` with a WHEP client, or use a player that supports WHEP natively (e.g. VLC 4, OBS 30+ monitor).

---

## Multi-source WebRTC room

Host interactive sessions with multiple speakers via LiveKit.

```typescript
import { LiveClient, LiveRoom } from '@hadidyapp/audio-live';

const live = new LiveClient({ apiKey: 'had_live_...' });

// Create a multi-speaker session
const session = await live.sessions.createSession({
  mode: 'multi',
  max_speakers: 4,
});
await live.sessions.startSession(session.id);

// Add a speaker — returns a short-lived participant token
const source = await live.sessions.createSource(session.id, {
  role: 'speaker',
  display_name: 'Ahmed',
});

// Connect and publish microphone
const room = new LiveRoom({
  livekitUrl: 'wss://livekit.hadidy.com',   // your LiveKit server, NOT session.ingest_url
  participantToken: source.participant_token!,
});
await room.connect();
await room.publishMicrophone();

room.on('participant-joined', (p) => console.log(`${p.identity} joined`));
room.on('participant-left',   (p) => console.log(`${p.identity} left`));
room.on('disconnected',       ()  => console.log('Disconnected from room'));

// When done
await room.unpublishMicrophone();
await room.disconnect();
```

---

## API

### `LiveClient`

All session methods are on `live.sessions.*`:

| Method | Description |
|---|---|
| `createSession(options?)` | Create a new session (WHIP by default) |
| `getSession(id)` | Fetch a session by ID |
| `listSessions(params?)` | Paginated session list |
| `listSessionsAll()` | Async iterator over all sessions |
| `updateSession(id, options)` | Update title, recording flag, etc. (before going live) |
| `startSession(id)` | Transition to `starting` state |
| `stopSession(id)` | End the session |
| `restartSession(id)` | Reuse key/settings from a previously ended session |
| `deleteSession(id)` | Permanently delete |
| `regenerateKey(id)` | Rotate stream key (session must not be live) |
| `updateNowPlaying(id, update)` | Push current + next track metadata |
| `clearNowPlaying(id)` | Wipe track info |
| `createSource(sessionId, options)` | Add a speaker to a multi-source room |
| `listSources(sessionId)` | List active speakers |
| `listParticipants(sessionId)` | List LiveKit participants |
| `listRecordings(sessionId)` | List finished recordings with download URLs |

### `LiveRoom`

| Method | Description |
|---|---|
| `connect()` | Join the LiveKit room |
| `disconnect()` | Leave the room |
| `publishMicrophone()` | Publish local mic as an audio track |
| `unpublishMicrophone()` | Stop publishing |

Events: `participant-joined`, `participant-left`, `track-subscribed`, `disconnected`.

### `HLSPlayer`

| Method | Description |
|---|---|
| `play()` / `pause()` | Playback control |
| `destroy()` | Tear down hls.js instance |

Events: `state-change`.

### `SessionState`

| Method | Description |
|---|---|
| `subscribe()` | Open SSE connection |
| `unsubscribe()` | Close connection |
| `on(event, handler)` | Attach event listener |

---

## License

MIT
