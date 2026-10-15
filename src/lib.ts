import * as duckdb from "@duckdb/duckdb-wasm";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import type { QueryResult, TableMetadata } from "./types";

let database: Promise<{ db: duckdb.AsyncDuckDB; connection: duckdb.AsyncDuckDBConnection }> | undefined;
const bundles: duckdb.DuckDBBundles = { mvp: { mainModule: mvpWasm, mainWorker: mvpWorker }, eh: { mainModule: ehWasm, mainWorker: ehWorker } };
const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Table names may contain only letters, numbers, and underscores.");
  return quotedIdentifier(value);
};
const quotedIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const escapedPath = (value: string) => value.replace(/'/g, "''");
async function open() {
  if (!database) database = (async () => {
    const bundle = await duckdb.selectBundle(bundles);
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), new Worker(bundle.mainWorker!));
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return { db, connection: await db.connect() };
  })();
  return database;
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  if (!sql.trim()) throw new Error("SQL is required.");
  const started = performance.now();
  const { connection } = await open();
  const result = await connection.query(sql);
  const columns = result.schema.fields.map(field => field.name);
  return { columns, column_types: result.schema.fields.map(field => field.type.toString()), rows: result.toArray().map(row => columns.map(column => (row as Record<string, unknown>)[column])), row_count: result.numRows, affected_rows: null, duration_ms: performance.now() - started, is_error: false, error_message: null };
}

export async function schemaMetadata(): Promise<TableMetadata[]> {
  const tables = await executeQuery("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name");
  return Promise.all(tables.rows.map(async ([name, kind]) => {
    const table = String(name);
    const columns = await executeQuery(`SELECT name, type, "notnull", pk FROM pragma_table_info('${escapedPath(table)}') ORDER BY cid`);
    const count = await executeQuery(`SELECT count(*) FROM ${identifier(table)}`);
    return { name: table, kind: String(kind), columns: columns.rows.map(([columnName, dataType, notNull, primaryKey]) => ({ name: String(columnName), data_type: String(dataType), nullable: !notNull, is_primary_key: Number(primaryKey) > 0 })), row_count: Number(count.rows[0][0]) };
  }));
}

export async function importFile(file: File, tableName: string, fileType: string) {
  const type = fileType.toLowerCase();
  const reader = { csv: "read_csv_auto", json: "read_json_auto", parquet: "read_parquet" }[type];
  if (!reader) throw new Error("Supported formats are CSV, JSON, and Parquet.");
  const source = `${crypto.randomUUID()}.${type}`;
  const { db } = await open();
  await db.registerFileBuffer(source, new Uint8Array(await file.arrayBuffer()));
  try {
    await executeQuery(`CREATE OR REPLACE TABLE ${identifier(tableName)} AS SELECT * FROM ${reader}('${escapedPath(source)}')`);
    return executeQuery(`SELECT * FROM ${identifier(tableName)} LIMIT 100`);
  } finally { await db.dropFile(source); }
}

export async function importValues(file: File, tableName: string, fileType: string) {
  const type = fileType.toLowerCase();
  const reader = { csv: "read_csv_auto", json: "read_json_auto", parquet: "read_parquet" }[type];
  if (!reader) throw new Error("Supported formats are CSV, JSON, and Parquet.");
  const source = `${crypto.randomUUID()}.${type}`;
  const { db } = await open();
  await db.registerFileBuffer(source, new Uint8Array(await file.arrayBuffer()));
  try {
    const sourceColumns = (await executeQuery(`DESCRIBE SELECT * FROM ${reader}('${escapedPath(source)}')`)).rows.map(row => String(row[0]));
    const targetColumns = (await executeQuery(`SELECT name FROM pragma_table_info('${escapedPath(tableName)}') ORDER BY cid`)).rows.map(row => String(row[0]));
    const sourceByName = new Map(sourceColumns.map(column => [column.toLowerCase(), column]));
    const columns = targetColumns.map(column => [column, sourceByName.get(column.toLowerCase())] as const).filter((pair): pair is [string, string] => Boolean(pair[1]));
    if (!columns.length) throw new Error(`No columns in ${file.name} match ${tableName}.`);
    await executeQuery(`INSERT INTO ${quotedIdentifier(tableName)} (${columns.map(([target]) => quotedIdentifier(target)).join(", ")}) SELECT ${columns.map(([, sourceColumn]) => quotedIdentifier(sourceColumn)).join(", ")} FROM ${reader}('${escapedPath(source)}')`);
    return executeQuery(`SELECT * FROM ${quotedIdentifier(tableName)} LIMIT 100`);
  } finally { await db.dropFile(source); }
}

export async function exportData(sql: string, format: string) {
  const type = format.toLowerCase();
  if (!/[a-z]+/.test(type) || !["csv", "json", "parquet"].includes(type)) throw new Error("Supported formats are CSV, JSON, and Parquet.");
  const source = `${crypto.randomUUID()}.${type}`;
  const { db } = await open();
  try {
    await executeQuery(`COPY (${sql.replace(/;\s*$/, "")}) TO '${source}' (FORMAT ${type.toUpperCase()})`);
    return new Blob([Uint8Array.from(await db.copyFileToBuffer(source))], { type: type === "csv" ? "text/csv" : type === "json" ? "application/json" : "application/octet-stream" });
  } finally { await db.dropFile(source); }
}
