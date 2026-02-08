export type TransactionType =
  | "hand_win"
  | "hand_loss"
  | "deposit"
  | "withdraw"
  | "faucet"
  | "buy_in"
  | "cash_out";

export interface TransactionEntry {
  id: string;
  type: TransactionType;
  amount: number;
  timestamp: number;
  details?: string;
}

const MAX_ENTRIES = 100;

const stores = new Map<string, TransactionStore>();

export function getStore(address: string): TransactionStore {
  const key = address.toLowerCase();
  let store = stores.get(key);
  if (!store) {
    store = new TransactionStore(key);
    stores.set(key, store);
  }
  return store;
}

export class TransactionStore {
  private key: string;
  private entries: TransactionEntry[];

  constructor(address: string) {
    this.key = `playfrens-txns-${address}`;
    this.entries = this.load();
  }

  private load(): TransactionEntry[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(this.key, JSON.stringify(this.entries));
  }

  add(entry: Omit<TransactionEntry, "id">): TransactionEntry {
    const full: TransactionEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    this.entries.unshift(full);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }
    this.save();
    return full;
  }

  getAll(): TransactionEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.save();
  }
}
