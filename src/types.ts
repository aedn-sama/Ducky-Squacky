export type QueryResult = {
  columns: string[];
  column_types: string[];
  rows: unknown[][];
  row_count: number;
  affected_rows: number | null;
  duration_ms: number;
  is_error: boolean;
  error_message: string | null;
};

export type ColumnMetadata = { name: string; data_type: string; nullable: boolean; is_primary_key: boolean };
export type TableMetadata = { name: string; kind: string; columns: ColumnMetadata[]; row_count: number };
export type QueryTab = { id: string; title: string; sql: string };
export type HistoryItem = { id: string; sql: string; timestamp: string; duration: number; error: boolean };
