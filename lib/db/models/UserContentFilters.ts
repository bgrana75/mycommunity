import mongoose, { Schema, Document, Model } from 'mongoose';
import type { MuteRule } from '@snapie/content-filter';

/** A user's content filters (muted tags/apps + presets), synced across
 *  snapie.io and HiveSnaps. Shape mirrors @snapie/content-filter's
 *  ContentFilterPrefs; the route validates with its sanitizePrefs. */
export interface IUserContentFilters extends Document<string> {
  _id: string; // Hive username (or `~` warm-up id)
  rules: MuteRule[];
  presets: string[];
  /** Client's ms-epoch change time — the last-write-wins clock. */
  updatedAt: number;
}

// Flat on purpose: `tag`/`app` presence depends on `kind` (see MuteRule).
const MuteRuleSchema = new Schema(
  {
    kind: { type: String, required: true, enum: ['tag', 'app', 'app_tag'] },
    tag: { type: String },
    app: { type: String },
  },
  { _id: false },
);

const UserContentFiltersSchema = new Schema<IUserContentFilters>(
  {
    _id: { type: String, required: true },
    rules: { type: [MuteRuleSchema], default: [] },
    presets: { type: [String], default: [] },
    updatedAt: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

export const UserContentFilters: Model<IUserContentFilters> =
  mongoose.models.UserContentFilters ||
  mongoose.model<IUserContentFilters>('UserContentFilters', UserContentFiltersSchema);
