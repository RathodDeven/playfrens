export const EVENTS = {
  // Room lifecycle
  CREATE_ROOM: "create-room",
  ROOM_CREATED: "room-created",
  JOIN_ROOM: "join-room",
  PLAYER_JOINED: "player-joined",
  LEAVE_ROOM: "leave-room",
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
