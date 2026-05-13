export type { LiveSession, LiveSessionCreateOptions, LiveSessionUpdateOptions } from '@hadidyapp/audio-sdk';
export type { LiveSource, LiveSourceCreateOptions, LiveSourceRole, LiveSourceStatus } from '@hadidyapp/audio-sdk';
export type { LiveParticipant, LiveRecording, NowPlayingInfo, NowPlayingUpdate } from '@hadidyapp/audio-sdk';
export type { LiveSessionMode, LiveSessionStatus } from '@hadidyapp/audio-sdk';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error' | 'paused';

export interface LiveClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export type LiveEventMap = {
  'status': string;
  'now-playing': NowPlayingInfo | null;
  'listeners': number;
  'error': Error;
};

import type { NowPlayingInfo } from '@hadidyapp/audio-sdk';
