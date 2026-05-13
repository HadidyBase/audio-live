import type {
  Room,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteAudioTrack,
  LocalParticipant,
  RoomEvent,
} from 'livekit-client';

type RoomEventMap = {
  'participant-joined': RemoteParticipant;
  'participant-left': RemoteParticipant;
  'track-subscribed': { track: RemoteAudioTrack; participant: RemoteParticipant };
  'disconnected': undefined;
};

type Listener<T> = (value: T) => void;

export interface LiveRoomOptions {
  livekitUrl: string;
  participantToken: string;
}

export class LiveRoom {
  private room: Room | null = null;
  private readonly livekitUrl: string;
  private readonly participantToken: string;
  private readonly emitters = new Map<string, Set<Listener<unknown>>>();

  constructor(options: LiveRoomOptions) {
    this.livekitUrl = options.livekitUrl;
    this.participantToken = options.participantToken;
  }

  async connect(): Promise<void> {
    const { Room: LiveKitRoom, RoomEvent: RE } = await import('livekit-client');
    this.room = new LiveKitRoom();

    this.room.on(RE.ParticipantConnected, (p) => this.emit('participant-joined', p));
    this.room.on(RE.ParticipantDisconnected, (p) => this.emit('participant-left', p));
    this.room.on(RE.TrackSubscribed, (track, _pub, participant) => {
      this.emit('track-subscribed', { track: track as RemoteAudioTrack, participant });
    });
    this.room.on(RE.Disconnected, () => this.emit('disconnected', undefined));

    await this.room.connect(this.livekitUrl, this.participantToken);
  }

  async disconnect(): Promise<void> {
    await this.room?.disconnect();
    this.room = null;
  }

  async publishMicrophone(): Promise<LocalAudioTrack> {
    if (!this.room) throw new Error('Not connected — call connect() first');
    const { createLocalAudioTrack } = await import('livekit-client');
    const track = await createLocalAudioTrack();
    await this.room.localParticipant.publishTrack(track as any);
    return track;
  }

  async unpublishMicrophone(): Promise<void> {
    if (!this.room) return;
    for (const pub of this.room.localParticipant.audioTrackPublications.values()) {
      await this.room.localParticipant.unpublishTrack(pub.track as any);
    }
  }

  get localParticipant(): LocalParticipant {
    if (!this.room) throw new Error('Not connected');
    return this.room.localParticipant;
  }

  get remoteParticipants(): RemoteParticipant[] {
    if (!this.room) return [];
    return Array.from(this.room.remoteParticipants.values());
  }

  on<K extends keyof RoomEventMap>(event: K, cb: Listener<RoomEventMap[K]>): this {
    if (!this.emitters.has(event)) this.emitters.set(event, new Set());
    this.emitters.get(event)!.add(cb as Listener<unknown>);
    return this;
  }

  off<K extends keyof RoomEventMap>(event: K, cb: Listener<RoomEventMap[K]>): this {
    this.emitters.get(event)?.delete(cb as Listener<unknown>);
    return this;
  }

  private emit<K extends keyof RoomEventMap>(event: K, value: RoomEventMap[K]): void {
    this.emitters.get(event)?.forEach((cb) => cb(value));
  }
}
