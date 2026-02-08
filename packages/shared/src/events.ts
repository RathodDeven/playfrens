export const EVENTS = {
  // Room lifecycle
  CREATE_ROOM: "create-room",
  ROOM_CREATED: "room-created",
  JOIN_ROOM: "join-room",
  PLAYER_JOINED: "player-joined",
  LEAVE_ROOM: "leave-room",
  LEAVE_NEXT_HAND: "leave-next-hand",
  LEAVE_NEXT_HAND_ACK: "leave-next-hand-ack",
  CASH_OUT: "cash-out",
  PLAYER_LEFT: "player-left",
  ROOM_LIST: "room-list",
  ROOM_UPDATE: "room-update",

  // Game flow
  START_HAND: "start-hand",
  GAME_STATE: "game-state",
  PLAYER_ACTION: "player-action",
  ACTION_REQUIRED: "action-required",
  HAND_COMPLETE: "hand-complete",

  // Yellow Network session signing
  SIGN_SESSION_REQUEST: "sign-session-request",
  SESSION_SIGNED: "session-signed",
  SESSION_READY: "session-ready",
  SESSION_ERROR: "session-error",

  // Social
  SEND_REACTION: "send-reaction",
  REACTION: "reaction",
  CHAT_MESSAGE: "chat-message",
  CHAT: "chat",

  // System
  ERROR: "error",
  REGISTER: "register",
  REGISTERED: "registered",
  CASHED_OUT: "cashed-out",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
