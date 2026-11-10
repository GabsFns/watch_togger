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
  user_id: string | null;
  guest_token_hash: string | null;
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
  added_by_participant_id: string | null;
  position: number;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  owner_id: string;
  name: string;
  max_participants: number;
  invite_code_hash: string;
  invite_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomWithParticipantCount extends Room {
  participant_count: number;
}

export interface InviteCreate {
  room_id: string;
  expires_in_hours?: number;
}

export interface InviteResult {
  invite_code: string;
  invite_url: string;
  expires_at: string | null;
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
