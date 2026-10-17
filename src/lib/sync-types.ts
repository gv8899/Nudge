export type SyncChange =
  | { kind: "task"; id: string; updatedAt: string }
  | { kind: "any" };
export type SyncEvent = SyncChange;
