import type { Database } from './database';

// Keep these aliases separate so CLI-generated database types can replace the file directly.
export type EventRow = Database['public']['Tables']['events']['Row'];
export type CompletionRow =
  Database['public']['Tables']['event_completions']['Row'];
