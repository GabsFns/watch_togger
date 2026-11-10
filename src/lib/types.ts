export type PlaybackState = "idle" | "paused" | "playing" | "buffering";

export interface RoomState {
  id: string;
  room_id: string;
  current_video_id: string | null;
  playback_state: PlaybackState;
  current_time_seconds: number;
  playback_rate: number;
  updated_at: string;
  updated_by: string | null;
  action_id: string | null;
  last_action: string | null;
}

export interface Participant {
  id: string;
  room_id: string;
  participant_name: string;
  last_seen_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  participant_id: string | null;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface QueueItem {
  id: string;
  room_id: string;
  video_id: string;
  video_title: string | null;
  added_by: string | null;
  position: number;
  created_at: string;
}

export type SyncActionType =
  | "load_video"
  | "play"
  | "pause"
  | "seek"
  | "rate_change"
  | "ended";

export interface SyncEvent {
  type: SyncActionType;
  videoId?: string;
  currentTime?: number;
  playbackRate?: number;
  actionId?: string;
  by?: string;
  at?: string;
}
