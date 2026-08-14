/** Compatibility types for UI-only pricing snapshots. Data is owned by Medusa. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EnumMap = {
  file_scan_status: "pending" | "clean" | "infected" | "not_required";
};

export type Enums<T extends keyof EnumMap> = EnumMap[T];
