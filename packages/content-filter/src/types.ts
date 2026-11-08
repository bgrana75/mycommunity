/** Hive's condenser/database APIs return json_metadata as a raw JSON string;
 *  bridge_api returns it pre-parsed. Callers can pass either. */
export type JsonMetadata = string | Record<string, unknown> | null | undefined;

/** The bits of a Hive post/comment/snap/wave the filter looks at. Any Hive
 *  content object satisfies this structurally. */
export interface FilterableContent {
  json_metadata?: JsonMetadata;
  body?: string | null;
}

/** One reason to hide content.
 *  - `tag`: matches `json_metadata.tags` *and* `#hashtags` written in the body.
 *  - `app`: matches `json_metadata.app`, ignoring any `/version` suffix
 *    (`hivesuite/0.1.262` → `hivesuite`).
 *  - `app_tag`: both at once. For apps that post games *and* normal content
 *    (HiveSuite scratchcards, Zingit's Scroddle). */
export type MuteRule =
  | { kind: 'tag'; tag: string }
  | { kind: 'app'; app: string }
  | { kind: 'app_tag'; app: string; tag: string };

/** A named, curated bundle of rules ("Hide game results"). The list can be
 *  refreshed from the server so new games don't need an app release. */
export interface FilterPreset {
  id: string;
  label: string;
  description: string;
  rules: MuteRule[];
}

export type PresetCatalog = Record<string, FilterPreset>;

/** Everything a user has chosen to hide. This is the shape that is persisted
 *  locally and synced to the server. */
export interface ContentFilterPrefs {
  /** Schema version, for future migrations. */
  v: 1;
  rules: MuteRule[];
  /** Preset ids the user switched on (e.g. `["games"]`). */
  presets: string[];
  /** ms epoch of the last user change. Used for last-write-wins sync. 0 means
   *  "never changed" (fresh defaults). */
  updatedAt: number;
}
