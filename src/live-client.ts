import { AudioClient, type AudioClientOptions } from '@hadidyapp/audio-sdk';
import { LiveResource } from '@hadidyapp/audio-sdk';

export class LiveClient {
  readonly sessions: LiveResource;

  private readonly _client: AudioClient;

  constructor(options: AudioClientOptions) {
    this._client = new AudioClient(options);
    this.sessions = this._client.live;
  }

  get sources() { return this._client.live; }
  get recordings() { return this._client.live; }
}
