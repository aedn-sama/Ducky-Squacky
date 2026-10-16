import { useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { insertTab } from "@codemirror/commands";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { TableMetadata } from "./types";

const sqlLanguage = sql();

const lastStatement = (value: string) => {
  let statement = value;
  sqlLanguage.language.parser.parse(value).iterate({ enter: node => { if (node.name === "Statement") statement = value.slice(node.from, node.to); } });
  return statement.trim();
};

const statementAt = (value: string, cursor: number) => {
  const lineStart = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const lineEnd = value.indexOf("\n", cursor);
  let statement = "";
  let distance = Infinity;
  sqlLanguage.language.parser.parse(value).iterate({ enter: node => {
    if (node.name !== "Statement" || node.from >= (lineEnd < 0 ? value.length : lineEnd) || node.to < lineStart) return;
    const nextDistance = Math.max(node.from - cursor, cursor - node.to, 0);
    if (nextDistance < distance) { statement = value.slice(node.from, node.to); distance = nextDistance; }
  } });
  return statement.trim();
};

const columnCompletion = (schema: TableMetadata[]) => (context: CompletionContext) => {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit) || /\b(?:from|join)\s*$/i.test(context.state.sliceDoc(0, word.from))) return null;
  return { from: word.from, options: [...new Set(schema.flatMap(table => table.columns.map(column => column.name)))].map(label => ({ label, type: "property" })), validFor: /^\w*$/ };
};

type Props = {
  value: string;
  schema: TableMetadata[];
  running: boolean;
  onChange: (value: string) => void;
  onRun: (sql: string) => void;
  onFormat: () => void;
  onSave: () => void;
};

export default function SqlEditor({ value, schema, running, onChange, onRun, onFormat, onSave }: Props) {
  const selection = useRef("");
  const cursor = useRef(0);
  const run = () => onRun(selection.current || statementAt(value, cursor.current) || lastStatement(value));
  const language = sql({ schema: Object.fromEntries(schema.map(table => [table.name, table.columns.map(column => column.name)])) });
  return <section className="editor-panel">
    <div className="panel-bar">
      <span className="language">DUCKDB SQL</span>
      <div className="editor-actions">
        <button onClick={onFormat}>Format</button>
        <button onClick={() => onChange("")}>Clear</button>
        <button onClick={() => navigator.clipboard.writeText(value)}>Copy</button>
        <button onClick={onSave}>Save</button>
        <button className="run" onClick={run} disabled={running}>{running ? "Running..." : "Run"}<kbd>Ctrl Enter</kbd></button>
      </div>
    </div>
    <CodeMirror className="sql-editor" value={value} height="100%" theme={oneDark} extensions={[language, language.language.data.of({ autocomplete: columnCompletion(schema) }), autocompletion(), Prec.highest(keymap.of([{ key: "Tab", run: insertTab }, { key: "Ctrl-Enter", run: () => { run(); return true; } }, { key: "Meta-Enter", run: () => { run(); return true; } }, { key: "Ctrl-s", run: () => { onSave(); return true; } }, { key: "Meta-s", run: () => { onSave(); return true; } }, { key: "Shift-Mod-f", run: () => { onFormat(); return true; } }]))]} onChange={onChange} onUpdate={update => { const range = update.state.selection.main; selection.current = update.state.sliceDoc(range.from, range.to).trim(); cursor.current = range.head; }} aria-label="SQL editor" />
  </section>;
}
