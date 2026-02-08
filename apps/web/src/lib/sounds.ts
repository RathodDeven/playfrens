type SoundType =
  | "deal"
  | "fold"
  | "check"
  | "call"
  | "raise"
  | "win"
  | "chipMove"
  | "turn";

const SOUND_PATHS: Record<SoundType, string> = {
  deal: "/sounds/deal.ogg",
  fold: "/sounds/fold.ogg",
  check: "/sounds/check.ogg",
  call: "/sounds/call.ogg",
  raise: "/sounds/raise.ogg",
  win: "/sounds/win.mp3",
  chipMove: "/sounds/chipMove.ogg",
  turn: "/sounds/turn.ogg",
};

const MUTE_KEY = "playfrens-muted";

class SoundManager {
  private muted: boolean;
  private cache = new Map<string, HTMLAudioElement>();

  constructor() {
    this.muted =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(MUTE_KEY) === "true"
        : false;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, String(this.muted));
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  play(sound: SoundType): void {
    if (this.muted) return;
    const path = SOUND_PATHS[sound];
    if (!path) return;

    try {
      let audio = this.cache.get(path);
      if (!audio) {
        audio = new Audio(path);
        this.cache.set(path, audio);
      }
      audio.currentTime = 0;
      audio.volume = 0.5;
      audio.play().catch(() => {
        /* sound file may not exist yet — graceful failure */
      });
    } catch {
      /* graceful failure */
    }
  }
}

export const soundManager = new SoundManager();
