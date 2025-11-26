import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import TiptapEditor, { MenuBar } from '@/components/TiptapEditor';
import type { Editor } from '@tiptap/react';

interface UserProfile {
  id: string;
  user_name: string;
  email: string;
  contact_no?: string;
  role: 'user' | 'admin' | 'super_admin';
  approval_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'hold' | 'suspend';
  employee_id?: string;
  super_admin?: boolean;
  hold_end_time?: string;
  created_at: string;
  updated_at: string;
}

interface ContractData {
  id: string;
  pid?: string | null;
  contract_name: string;
  description?: string;
  content?: string;
  status: 'active' | 'inactive' | 'draft';
  created_by: string;
  assigned_to?: string;
  variables?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface SupabaseTableMetadata {
  name: string;
  schema?: string;
  comment?: string | null;
}

interface SupabaseColumnMetadata {
  table: string;
  name: string;
  dataType?: string | null;
  position?: number;
}

interface SupabaseValueOption {
  table: string;
  column: string;
  display: string;
  rawValue: unknown;
  row: Record<string, any>;
  rowIndex: number;
}

const SUPABASE_TABLE_EXCLUDE = new Set(['messages', 'admin_members', 'contracts']);

const VARIABLE_KEY_DEFAULT = 'plain_text';

const VARIABLE_KEY_OPTIONS = [
  { label: 'Plain Text', value: 'plain_text' },
  { label: 'User Id', value: 'user_id' },
  { label: 'User Name', value: 'user_name' },
  { label: 'Influencer Name', value: 'influencer_name' },
  { label: 'address', value: 'address' },
  { label: 'Phone No', value: 'phone_no' },
  { label: 'Date', value: 'date' },
  { label: 'Product', value: 'product' },
  { label: 'Company name', value: 'company_name' },
  { label: 'Signature', value: 'signature' },
  { label: 'Custom', value: 'custom' },
] as const;

type VariableKeyOptionValue = (typeof VARIABLE_KEY_OPTIONS)[number]['value'];

const VARIABLE_DEFAULT_SOURCES: Partial<
  Record<
    VariableKeyOptionValue,
    {
      table: string;
      column: string;
      schema?: string;
    }
  >
> = {
  user_id: { table: "user_profiles", column: "user_id", schema: "public" },
  user_name: { table: "user_profiles", column: "user_name", schema: "public" },
};

const DEFAULT_TABLE_SUGGESTIONS: Array<{ name: string; schema?: string }> = [
  { name: "user_profiles", schema: "public" },
  { name: "campaigns", schema: "public" },
  { name: "companies", schema: "public" },
  { name: "influencers", schema: "public" },
];

const DEFAULT_COLUMN_SUGGESTIONS: Record<
  string,
  Array<{ name: string; dataType?: string | null }>
> = {
  user_profiles: [
    { name: "user_id", dataType: "uuid" },
    { name: "user_name", dataType: "text" },
    { name: "email", dataType: "text" },
  ],
  campaigns: [
    { name: "id", dataType: "uuid" },
    { name: "name", dataType: "text" },
    { name: "brand", dataType: "text" },
  ],
  companies: [
    { name: "id", dataType: "uuid" },
    { name: "name", dataType: "text" },
  ],
  influencers: [
    { name: "id", dataType: "uuid" },
    { name: "name", dataType: "text" },
    { name: "email", dataType: "text" },
  ],
};

const CONTRACT_PID_PREFIX = "CON";

const extractContractPidNumber = (pid?: string | null): number => {
  if (!pid) return -1;
  const match = `${pid}`.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : -1;
};

type VariableEntry = {
  descriptors: string[];
};

const normalizeVariablesFromServer = (
  raw: Record<string, any> | null | undefined,
): Record<string, VariableEntry> => {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized: Record<string, VariableEntry> = {};

  Object.entries(raw).forEach(([key, value]) => {
    if (!key) {
      return;
    }
    if (value && typeof value === "object" && value !== null) {
      const entry = value as { descriptors?: unknown; descriptor?: unknown; occurrences?: unknown };
      if (Array.isArray(entry.descriptors)) {
        const descriptors = entry.descriptors
          .map((item) => (typeof item === "string" ? item : ""))
          .map((item) => item.trim());
        normalized[key] = { descriptors };
        return;
      }
      if (typeof entry.descriptor === "string") {
        const descriptor = entry.descriptor.trim();
        const occurrenceCount =
          typeof entry.occurrences === "number" && Number.isFinite(entry.occurrences) && entry.occurrences > 1
            ? Math.floor(entry.occurrences)
            : 1;
        const descriptors = Array.from({ length: occurrenceCount }, () => descriptor);
        normalized[key] = { descriptors };
        return;
      }
    }
    // legacy string format fallback
    const descriptor = typeof value === "string" ? value.trim() : "";
    normalized[key] = { descriptors: descriptor ? [descriptor] : [] };
  });

  return normalized;
};

const TIPTAP_STORAGE_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --color-base: #111827;
  --color-muted: #4b5563;
}

body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

.tiptap-rendered {
  font-family: var(--font-base);
  font-size: 11.5pt;
  line-height: 1.7;
  color: var(--color-base);
  word-break: break-word;
}

.tiptap-rendered strong {
  font-weight: 600;
}

.tiptap-rendered em {
  font-style: italic;
}

.tiptap-rendered u {
  text-decoration: underline;
}

.tiptap-rendered s {
  text-decoration: line-through;
}

.tiptap-rendered mark {
  background-color: #fef08a;
  padding: 0 2px;
  border-radius: 2px;
}

.tiptap-rendered p {
  margin: 0 0 14px;
}

.tiptap-rendered h1,
.tiptap-rendered h2,
.tiptap-rendered h3,
.tiptap-rendered h4,
.tiptap-rendered h5,
.tiptap-rendered h6 {
  margin: 26px 0 14px;
  font-weight: 600;
  line-height: 1.3;
}

.tiptap-rendered h1 { font-size: 30px; }
.tiptap-rendered h2 { font-size: 24px; }
.tiptap-rendered h3 { font-size: 20px; }
.tiptap-rendered h4 { font-size: 18px; }
.tiptap-rendered h5 { font-size: 16px; }
.tiptap-rendered h6 { font-size: 14px; }

.tiptap-rendered ul,
.tiptap-rendered ol {
  margin: 0 0 14px 26px;
  padding: 0;
}

.tiptap-rendered ul { list-style: disc; }
.tiptap-rendered ul ul { list-style: circle; }
.tiptap-rendered ul ul ul { list-style: square; }

.tiptap-rendered ol { list-style: decimal; }
.tiptap-rendered ol ol { list-style: lower-alpha; }
.tiptap-rendered ol ol ol { list-style: lower-roman; }

.tiptap-rendered li {
  margin: 0 0 8px;
}

.tiptap-rendered blockquote {
  margin: 14px 0;
  padding: 12px 18px;
  border-left: 4px solid #d1d5db;
  background-color: #f9fafb;
  color: var(--color-muted);
}

.tiptap-rendered table {
  width: 100%;
  border-collapse: collapse;
  margin: 18px 0;
  font-size: 10.5pt;
}

.tiptap-rendered table th,
.tiptap-rendered table td {
  border: 1px solid #d1d5db;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

.tiptap-rendered table thead th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.tiptap-rendered pre {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 14px;
  border-radius: 8px;
  margin: 14px 0;
  font-family: var(--font-mono);
  font-size: 10pt;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
}

.tiptap-rendered code {
  font-family: var(--font-mono);
  font-size: 10pt;
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 4px;
}

.tiptap-rendered pre code {
  background: transparent;
  padding: 0;
}

.tiptap-rendered a {
  color: #2563eb;
  text-decoration: underline;
}

.tiptap-rendered hr {
  border: 0;
  border-top: 1px solid #d1d5db;
  margin: 28px 0;
}

.tiptap-rendered .text-left,
.tiptap-rendered .has-text-align-left,
.tiptap-rendered [style*='text-align: left'] {
  text-align: left !important;
}

.tiptap-rendered .text-center,
.tiptap-rendered .has-text-align-center,
.tiptap-rendered [style*='text-align: center'] {
  text-align: center !important;
}

.tiptap-rendered .text-right,
.tiptap-rendered .has-text-align-right,
.tiptap-rendered [style*='text-align: right'] {
  text-align: right !important;
}

.tiptap-rendered .text-justify,
.tiptap-rendered .has-text-align-justify,
.tiptap-rendered [style*='text-align: justify'] {
  text-align: justify !important;
}

.tiptap-rendered .tiptap-image-wrapper {
  display: block;
  margin: 18px 0;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="right"] {
  text-align: right;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="center"] {
  text-align: center;
}

.tiptap-rendered .tiptap-image-wrapper[data-alignment="left"] {
  text-align: left;
}

.tiptap-rendered .tiptap-image-wrapper img {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 0;
}

.tiptap-rendered img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 18px 0;
}

.tiptap-rendered .signature-box,
.tiptap-rendered [data-signature="true"],
.ProseMirror .signature-box,
.ProseMirror [data-signature="true"] {
  display: inline-block !important;
  width: 200px !important;
  height: 140px !important;
  border: 1px solid #9ca3af !important;
  background-color: transparent !important;
  border-radius: 3px !important;
  padding: 2px !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 136px !important;
  font-size: 10px !important;
  color: #6b7280 !important;
  box-sizing: border-box !important;
  margin-top: 20px !important;
  margin-bottom: 20px !important;
  margin-left: 25px !important;
  margin-right: 25px !important;
  /* Force spacing between signature boxes on same line */
  min-width: 200px !important;
  white-space: nowrap !important;
}

/* Ensure spacing between adjacent signature boxes */
.tiptap-rendered .signature-box + .signature-box,
.tiptap-rendered [data-signature="true"] + [data-signature="true"],
.ProseMirror .signature-box + .signature-box,
.ProseMirror [data-signature="true"] + [data-signature="true"] {
  margin-left: 50px !important; /* Double spacing when boxes are adjacent */
}

/* Prevent parent span from wrapping signature boxes */
.tiptap-rendered span[style*="font-size: 10px"],
.ProseMirror span[style*="font-size: 10px"] {
  white-space: nowrap !important;
  display: inline-block !important;
}
`;

const wrapContentForStorage = (html: string): string => {
  const safeHtml = html || '<p></p>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><style>${TIPTAP_STORAGE_STYLE}</style></head><body><div class="tiptap-rendered">${safeHtml}</div></body></html>`;
};

const extractVariableKeysFromContent = (content: string): Map<string, number> => {
  const counts = new Map<string, number>();
  if (!content) {
    return counts;
  }

  const regex = /var\[\s*\{\{\s*([^}\s]+(?:[^}]*)?)\s*\}\}\s*\]/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawKey = match[1]?.trim();
    if (rawKey) {
      const current = counts.get(rawKey) ?? 0;
      counts.set(rawKey, current + 1);
    }
  }

  return counts;
};

const unwrapContentFromStorage = (html?: string | null): string => {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rendered = doc.querySelector('.tiptap-rendered');
    return rendered ? rendered.innerHTML : doc.body.innerHTML || '';
  } catch {
    const match = html.match(/<div[^>]*class=[\"']?[^\"']*tiptap-rendered[^\"']*[\"']?[^>]*>([\s\S]*?)<\/div>/i);
    if (match && match[1]) {
      return match[1];
    }
    return html;
  }
};

const prettifyKey = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const formatValue = (value: unknown, indentLevel = 0): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const parsed = typeof trimmed === 'string' ? tryParseJson(trimmed) : trimmed;
    if (parsed !== trimmed) {
      return formatValue(parsed, indentLevel);
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '';
    }
    if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
      return value.join(', ');
    }
    return value
      .map((item, index) => {
        const formatted = formatValue(item, indentLevel + 1);
        if (!formatted) {
          return '';
        }
        const label = `${index + 1}.`;
        const indent = '  '.repeat(indentLevel);
        return formatted
          .split('\n')
          .map((line, lineIdx) =>
            lineIdx === 0
              ? `${indent}${label} ${line}`
              : `${indent}    ${line}`,
          )
          .join('\n');
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, any>);
    if (entries.length === 0) {
      return '';
    }
    return entries
      .map(([key, val]) => {
        const formatted = formatValue(val, indentLevel + 1);
        if (!formatted) {
          return '';
        }
        const indent = '  '.repeat(indentLevel);
        return formatted
          .split('\n')
          .map((line, lineIdx) =>
            lineIdx === 0
              ? `${indent}${prettifyKey(key)}: ${line}`
              : `${indent}  ${line}`,
          )
          .join('\n');
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(value);
};

const formatRowForInsertion = (row: Record<string, any>, omitKeys: Set<string>): string => {
  return Object.entries(row)
    .filter(([key]) => !omitKeys.has(key))
    .map(([key, value]) => {
      const prettyKey = prettifyKey(key);
      const formattedValue = formatValue(value, 0);
      if (!formattedValue) {
        return '';
      }
      return `${prettyKey}: ${formattedValue}`;
    })
    .filter(Boolean)
    .join('\n');
};

const getRowEntries = (row: Record<string, any>, omitKeys: Set<string>) =>
  Object.entries(row)
    .filter(([key]) => !omitKeys.has(key))
    .map(([key, value]) => ({
      key: prettifyKey(key),
      value: formatValue(value, 0),
    }))
    .filter((entry) => entry.value);

interface SupabaseMentionPanelProps {
  anchor: { left: number; top: number };
  mode: 'tables' | 'columns' | 'values';
  tables: SupabaseTableMetadata[];
  tablesLoading: boolean;
  tablesError: string | null;
  columns: SupabaseColumnMetadata[];
  columnsLoading: boolean;
  columnsError: string | null;
  selectedTable: SupabaseTableMetadata | null;
  onTableSelect: (table: SupabaseTableMetadata) => void;
  onColumnSelect: (column: SupabaseColumnMetadata) => void;
  selectedColumn: SupabaseColumnMetadata | null;
  values: SupabaseValueOption[];
  valuesLoading: boolean;
  valuesError: string | null;
  valueSearch: string;
  onValueSearchChange: (value: string) => void;
  onValueSelect: (value: SupabaseValueOption) => void;
  onBack: () => void;
  onClose: (options?: { insertFallback?: boolean }) => void;
}

const SupabaseMentionPanel = ({
  anchor,
  mode,
  tables,
  tablesLoading,
  tablesError,
  columns,
  columnsLoading,
  columnsError,
  selectedTable,
  onTableSelect,
  onColumnSelect,
  selectedColumn,
  values,
  valuesLoading,
  valuesError,
  valueSearch,
  onValueSearchChange,
  onValueSelect,
  onBack,
  onClose,
}: SupabaseMentionPanelProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const PANEL_WIDTH = 320;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose({ insertFallback: true });
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose({ insertFallback: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const computedLeft = Math.max(
    16 + scrollX,
    Math.min(anchor.left - PANEL_WIDTH / 2, scrollX + viewportWidth - PANEL_WIDTH - 16),
  );
  const computedTop = anchor.top + 12;

  const headerTitle =
    mode === 'tables'
      ? 'Insert from Supabase'
      : mode === 'columns'
      ? `Select a column from ${selectedTable?.name ?? 'table'}`
      : `Select a value for ${selectedTable?.name ?? 'table'}.${selectedColumn?.name ?? 'column'}`;

  const headerSubtitle =
    mode === 'tables'
      ? 'Choose a table to browse columns and values'
      : mode === 'columns'
      ? 'Pick the column whose values you want to insert'
      : 'Choose the value to insert into the editor';

  const content = (
    <div
      ref={panelRef}
      className="z-[9999] w-80 max-w-[90vw] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{
        position: 'absolute',
        left: computedLeft,
        top: computedTop,
      }}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-800">{headerTitle}</span>
          <span className="text-xs text-gray-500">{headerSubtitle}</span>
        </div>
        <button
          type="button"
          onClick={() => onClose({ insertFallback: true })}
          className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close supabase picker"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-gray-100 px-3 py-2">
        {mode === 'values' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
            >
              Back
            </button>
            <input
              value={valueSearch}
              onChange={(event) => onValueSearchChange(event.target.value)}
              autoFocus
              className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-300"
              placeholder="Search records..."
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {mode === 'columns' && (
              <button
                type="button"
                onClick={onBack}
                className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
              >
                Back
              </button>
            )}
            <div className="flex flex-1 items-center gap-2 rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 bg-gray-50">
              {mode === 'columns'
                ? `Columns in ${selectedTable?.name ?? ''}`
                : 'All accessible tables'}
            </div>
          </div>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {mode === 'tables' ? (
          <>
            {tablesLoading && (
              <div className="px-3 py-4 text-sm text-gray-500">Loading tables from Supabase...</div>
            )}
            {!tablesLoading && tablesError && (
              <div className="space-y-2 px-3 py-4 text-sm text-red-500">
                <p>{tablesError}</p>
                <p className="text-xs text-gray-600">
                  Supabase REST only exposes schemas that you explicitly allow. To surface system tables, create a view
                  in the <code>public</code> schema and grant <code>select</code> on it:
                </p>
                <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
{`create or replace view public.available_tables as
  select tablename
  from pg_catalog.pg_tables
  where schemaname = 'public';`}
                </pre>
                <p className="text-xs text-gray-600">
                  Then replace <code>pg_tables</code> with <code>available_tables</code> in the fetch helper or adjust
                  the RLS policy accordingly.
                </p>
              </div>
            )}
            {!tablesLoading && !tablesError && tables.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">No tables found.</div>
            )}
            {!tablesLoading &&
              !tablesError &&
              tables.map((table) => (
                <button
                  key={`${table.schema ?? 'public'}.${table.name}`}
                  type="button"
                  onClick={() => onTableSelect(table)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-violet-50"
                >
                  <span className="text-sm font-medium text-gray-900">{table.name}</span>
                  <span className="text-xs text-gray-500">{table.schema ?? 'public'}</span>
                </button>
              ))}
          </>
        ) : mode === 'columns' ? (
          <>
            {columnsLoading && (
              <div className="px-3 py-4 text-sm text-gray-500">Loading columns for {selectedTable?.name}…</div>
            )}
            {!columnsLoading && columnsError && (
              <div className="px-3 py-4 text-sm text-red-500">
                {columnsError || 'Unable to load columns. Check your Supabase policies.'}
              </div>
            )}
            {!columnsLoading && !columnsError && columns.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">
                No columns found. Confirm the table exists and is accessible.
              </div>
            )}
            {!columnsLoading &&
              !columnsError &&
              columns.map((column) => (
                <button
                  key={`${column.table}.${column.name}`}
                  type="button"
                  onClick={() => onColumnSelect(column)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-violet-50"
                >
                  <span className="text-sm font-medium text-gray-900">{column.name}</span>
                  {column.dataType && <span className="text-xs text-gray-500">{column.dataType}</span>}
                </button>
              ))}
          </>
        ) : (
          <>
            {valuesLoading && (
              <div className="px-3 py-4 text-sm text-gray-500">
                Loading values for {selectedColumn?.name}…
              </div>
            )}
            {!valuesLoading && valuesError && (
              <div className="px-3 py-4 text-sm text-red-500">
                {valuesError} Check table permissions if this persists.
              </div>
            )}
            {!valuesLoading && !valuesError && values.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">No matching values found.</div>
            )}
            {!valuesLoading &&
              !valuesError &&
              values.map((item) => (
                <button
                  key={`${item.table}.${item.column}.${item.display}`}
                  type="button"
                  onClick={() => onValueSelect(item)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-violet-50"
                >
                  <span className="text-sm font-medium text-gray-900 truncate max-w-full">{item.display}</span>
                  <span className="text-xs text-gray-500">
                    {selectedTable?.name}.{selectedColumn?.name}
                  </span>
                </button>
              ))}
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

// Helper function to format time since last save
const formatTimeSince = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const ContractEditor = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contractName, setContractName] = useState<string>("");
  const [contractDescription, setContractDescription] = useState<string>("");
  const [contractContent, setContractContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isVariableDialogOpen, setIsVariableDialogOpen] = useState<boolean>(false);
  const [variableKeyOption, setVariableKeyOption] = useState<VariableKeyOptionValue>(VARIABLE_KEY_DEFAULT);
  const [variableKey, setVariableKey] = useState<string>(VARIABLE_KEY_DEFAULT);
  const [variableSourceTable, setVariableSourceTable] = useState<string>("");
  const [variableSourceColumn, setVariableSourceColumn] = useState<string>("");
  const [variableSourceSchema, setVariableSourceSchema] = useState<string>("");
  const [signatureType, setSignatureType] = useState<'influencer' | 'user' | ''>('');
  const [variableTables, setVariableTables] = useState<SupabaseTableMetadata[]>([]);
  const [variableTablesLoading, setVariableTablesLoading] = useState<boolean>(false);
  const [variableTablesError, setVariableTablesError] = useState<string | null>(null);
  const [variableColumns, setVariableColumns] = useState<SupabaseColumnMetadata[]>([]);
  const [variableColumnsLoading, setVariableColumnsLoading] = useState<boolean>(false);
  const [variableColumnsError, setVariableColumnsError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, VariableEntry>>({});
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractPid, setContractPid] = useState<string | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [supabaseMentionState, setSupabaseMentionState] = useState<{
    anchor: { left: number; top: number };
    range: { from: number; to: number };
  } | null>(null);
  const [supabaseTables, setSupabaseTables] = useState<SupabaseTableMetadata[]>([]);
  const [supabaseTablesLoading, setSupabaseTablesLoading] = useState<boolean>(false);
  const [supabaseTablesError, setSupabaseTablesError] = useState<string | null>(null);
  const [supabaseSelectedTable, setSupabaseSelectedTable] = useState<SupabaseTableMetadata | null>(null);
  const [supabaseColumns, setSupabaseColumns] = useState<SupabaseColumnMetadata[]>([]);
  const [supabaseColumnsLoading, setSupabaseColumnsLoading] = useState<boolean>(false);
  const [supabaseColumnsError, setSupabaseColumnsError] = useState<string | null>(null);
  const [supabaseSelectedColumn, setSupabaseSelectedColumn] = useState<SupabaseColumnMetadata | null>(null);
  const [supabaseValues, setSupabaseValues] = useState<SupabaseValueOption[]>([]);
  const [supabaseValuesLoading, setSupabaseValuesLoading] = useState<boolean>(false);
  const [supabaseValuesError, setSupabaseValuesError] = useState<string | null>(null);
  const [supabaseValueSearch, setSupabaseValueSearch] = useState<string>('');
  const [supabaseSkipNextValueFetch, setSupabaseSkipNextValueFetch] = useState<boolean>(false);
  const [supabaseLastSelection, setSupabaseLastSelection] = useState<{
    table: SupabaseTableMetadata;
    columns: SupabaseColumnMetadata[];
    row: Record<string, any>;
    rowIndex: number;
    currentColumnIndex: number;
  } | null>(null);
  const [supabaseLastValueSequence, setSupabaseLastValueSequence] = useState<{
    table: SupabaseTableMetadata;
    column: SupabaseColumnMetadata;
    columns: SupabaseColumnMetadata[];
    values: SupabaseValueOption[];
    currentIndex: number;
    searchTerm: string;
  } | null>(null);
  const [supabaseRowDialog, setSupabaseRowDialog] = useState<{
    open: boolean;
    entries: Array<{ key: string; value: string }>;
    table?: string;
    rowIndex?: number;
    row?: Record<string, any>;
  }>({ open: false, entries: [] });
  const supabaseDragPreviewRef = useRef<HTMLElement | null>(null);

  const fetchNextContractPid = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase
      .from("contracts")
      .select("pid")
      .not("pid", "is", null);

    if (error) {
      console.error("ContractEditor: Failed to fetch contract pids", error);
      throw error;
    }

    let maxNumber = 0;
    ((data ?? []) as Array<{ pid: string | null }>).forEach((row) => {
      const value = extractContractPidNumber(row.pid);
      if (value > maxNumber) {
        maxNumber = value;
      }
    });

    const nextNumber = maxNumber + 1;
    return `${CONTRACT_PID_PREFIX}${String(nextNumber).padStart(4, "0")}`;
  }, []);

  useEffect(() => {
    if (contractId) {
      return;
    }

    let isMounted = true;
    fetchNextContractPid()
      .then((pid) => {
        if (isMounted) {
          setContractPid(pid);
        }
      })
      .catch((error) => {
        console.warn("ContractEditor: unable to prefetch contract pid", error);
        if (isMounted) {
          setContractPid(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [contractId, fetchNextContractPid]);

  const handleOpenVariableDialog = useCallback(() => {
    setVariableKeyOption(VARIABLE_KEY_DEFAULT);
    setVariableKey(VARIABLE_KEY_DEFAULT);
    setVariableSourceTable('');
    setVariableSourceColumn('');
    setVariableSourceSchema('');
    setIsVariableDialogOpen(true);
  }, []);

  const handleVariableDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsVariableDialogOpen(open);
      if (!open) {
        setVariableKeyOption(VARIABLE_KEY_DEFAULT);
        setVariableKey(VARIABLE_KEY_DEFAULT);
        setVariableSourceTable('');
        setVariableSourceColumn('');
        setVariableSourceSchema('');
        setVariableTables([]);
        setVariableTablesError(null);
        setVariableColumns([]);
        setVariableColumnsError(null);
        setSignatureType(''); // Reset signature type when dialog closes
      }
    },
    []
  );

  const handleVariableKeyOptionChange = useCallback((value: VariableKeyOptionValue) => {
    setVariableKeyOption(value);
    if (value === 'custom') {
      setVariableKey('');
    } else {
      setVariableKey(value);
    }
    
    // Reset signature type when signature is selected/deselected
    if (value === 'signature') {
      setSignatureType(''); // Reset to empty, user will select
    } else {
      setSignatureType('');
    }
    
    const defaults = VARIABLE_DEFAULT_SOURCES[value];
    if (defaults) {
      setVariableSourceTable(defaults.table);
      setVariableSourceColumn(defaults.column);
      setVariableSourceSchema(defaults.schema ?? '');
    } else {
      setVariableSourceTable('');
      setVariableSourceColumn('');
      setVariableSourceSchema('');
    }
  }, []);
  const loadVariableTables = useCallback(async () => {
    setVariableTablesLoading(true);
    setVariableTablesError(null);
    try {
      const { data, error } = await supabase
        .from('available_tables')
        .select('tablename')
        .order('tablename', { ascending: true })
        .limit(200);

      if (error) {
        throw error;
      }

      const typedData = (data ?? []) as Array<{ tablename: string }>;
      const filtered = typedData
        .map((item) => ({
          name: item.tablename,
          schema: 'public',
        }))
        .filter((item) => !SUPABASE_TABLE_EXCLUDE.has(item.name));

      if (filtered.length) {
        setVariableTables(filtered);
      } else {
        setVariableTables(DEFAULT_TABLE_SUGGESTIONS);
      }
    } catch (error: any) {
      console.error('Variable dialog: failed to load tables', error);
      setVariableTables(DEFAULT_TABLE_SUGGESTIONS);
      setVariableTablesError(
        error?.message
          ? `${error.message}. Using fallback table list.`
          : 'Unable to load tables. Using fallback table list.'
      );
    } finally {
      setVariableTablesLoading(false);
    }
  }, []);

  const loadVariableColumns = useCallback(
    async (tableName: string) => {
      if (!tableName) {
        setVariableColumns([]);
        setVariableColumnsError(null);
        return;
      }

      setVariableColumnsLoading(true);
      setVariableColumnsError(null);
      try {
        const { data, error } = await supabase
          .from('available_columns')
          .select('column_name, data_type, ordinal_position')
          .eq('tablename', tableName)
          .order('ordinal_position', { ascending: true })
          .limit(200);

        if (error) {
          throw error;
        }
        
        if (data) {
          setContractPid((data as any).pid ?? contractPid ?? null);
        }

        const typedData = (data ?? []) as Array<{ column_name: string; data_type: string | null; ordinal_position?: number }>;
        const mapped = typedData.map((item) => ({
          table: tableName,
          name: item.column_name,
          dataType: item.data_type,
          position: item.ordinal_position,
        }));

        if (mapped.length) {
          setVariableColumns(mapped);
        } else if (DEFAULT_COLUMN_SUGGESTIONS[tableName]?.length) {
          setVariableColumns(
            DEFAULT_COLUMN_SUGGESTIONS[tableName].map((item) => ({
              table: tableName,
              name: item.name,
              dataType: item.dataType ?? null,
            }))
          );
        } else {
          setVariableColumns([]);
        }
      } catch (error: any) {
        console.error(`Variable dialog: failed to load columns for ${tableName}`, error);
        if (DEFAULT_COLUMN_SUGGESTIONS[tableName]?.length) {
          setVariableColumns(
            DEFAULT_COLUMN_SUGGESTIONS[tableName].map((item) => ({
              table: tableName,
              name: item.name,
              dataType: item.dataType ?? null,
            }))
          );
          setVariableColumnsError(
            error?.message
              ? `${error.message}. Showing fallback columns.`
              : 'Unable to load columns. Showing fallback columns.'
          );
        } else {
          setVariableColumns([]);
          setVariableColumnsError(error?.message ?? 'Unable to load columns.');
        }
      } finally {
        setVariableColumnsLoading(false);
      }
    },
    [],
  );

  const closeSupabaseRowDialog = useCallback(() => {
    setSupabaseRowDialog({ open: false, entries: [] });
  }, []);
  const handleInsertFullRow = useCallback(() => {
    if (!editor || !supabaseRowDialog.row) {
      closeSupabaseRowDialog();
      return;
    }
    const text = formatRowForInsertion(supabaseRowDialog.row, new Set(['id']));
    if (text) {
      editor.chain().focus().insertContent(`${text}\n`).run();
    }
    closeSupabaseRowDialog();
  }, [editor, supabaseRowDialog.row, closeSupabaseRowDialog]);

  const fetchSupabaseTables = useCallback(async () => {
      setSupabaseTablesLoading(true);
      setSupabaseTablesError(null);
      try {
        const { data, error } = await supabase
          .from('available_tables')
          .select('tablename')
          .order('tablename', { ascending: true })
          .limit(200);

        if (error) {
          throw error;
        }
        
        if (data) {
          setContractPid((data as any).pid ?? contractPid ?? null);
        }

        const typedData = data as Array<{ tablename: string }> | null;

        const mapped: SupabaseTableMetadata[] =
          typedData
            ?.map((item) => ({
              name: item.tablename,
              schema: 'public',
            }))
            .filter((item) => !SUPABASE_TABLE_EXCLUDE.has(item.name)) ?? [];

        setSupabaseTables(mapped);
      } catch (error: any) {
        console.error('Supabase mention: failed to fetch tables', error);
        setSupabaseTables([]);
        setSupabaseTablesError(error?.message ?? 'Unable to load tables.');
      } finally {
        setSupabaseTablesLoading(false);
      }
    },
    [],
  );

  const fetchSupabaseTableColumns = useCallback(
    async (tableName: string) => {
      setSupabaseColumnsLoading(true);
      setSupabaseColumnsError(null);
      try {
        const { data, error } = await supabase
          .from('available_columns')
          .select('column_name, data_type, ordinal_position')
          .eq('tablename', tableName)
          .order('ordinal_position', { ascending: true })
          .limit(200);

        if (error) {
          throw error;
        }

        const typedData = data as Array<{ column_name: string; data_type: string | null; ordinal_position?: number }> | null;
        const mapped: SupabaseColumnMetadata[] =
          typedData?.map((item) => ({
            table: tableName,
            name: item.column_name,
            dataType: item.data_type,
            position: item.ordinal_position,
          })) ?? [];

        setSupabaseColumns(mapped);
      } catch (error: any) {
        console.error(`Supabase mention: failed to fetch columns for ${tableName}`, error);
        setSupabaseColumns([]);
        setSupabaseColumnsError(error?.message ?? 'Unable to load columns.');
      } finally {
        setSupabaseColumnsLoading(false);
      }
    },
    [],
  );

  const fetchSupabaseColumnValues = useCallback(
    async (tableName: string, columnName: string, searchTerm: string) => {
      setSupabaseValuesLoading(true);
      setSupabaseValuesError(null);
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(200);

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as Array<Record<string, any>>;
        const seen = new Set<string>();
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const mapped: SupabaseValueOption[] = [];

        rows.forEach((row, rowIndex) => {
          const rawValue = row[columnName];
          if (rawValue === null || rawValue === undefined) {
            return;
          }
          const display =
            typeof rawValue === 'string'
              ? rawValue
              : typeof rawValue === 'number'
              ? String(rawValue)
              : JSON.stringify(rawValue);

          if (normalizedSearch && !display.toLowerCase().includes(normalizedSearch)) {
            return;
          }

          if (seen.has(display)) {
            return;
          }
          seen.add(display);

          mapped.push({
            table: tableName,
            column: columnName,
            display,
            rawValue,
            row,
            rowIndex,
          });
        });

        setSupabaseValues(mapped);
      } catch (error: any) {
        console.error(`Supabase mention: failed to fetch values for ${tableName}.${columnName}`, error);
        setSupabaseValues([]);
        setSupabaseValuesError(error?.message ?? 'Unable to load values.');
      } finally {
        setSupabaseValuesLoading(false);
      }
    },
    [],
  );

  const handleSupabaseMentionTrigger = useCallback(
    ({ position, range }: { position: { left: number; top: number }; range: { from: number; to: number } }) => {
      setSupabaseMentionState({ anchor: position, range });
      setSupabaseLastSelection(null);
      setSupabaseLastValueSequence(null);
      setSupabaseSelectedTable(null);
      setSupabaseColumns([]);
      setSupabaseColumnsError(null);
      setSupabaseSelectedColumn(null);
      setSupabaseValues([]);
      setSupabaseValueSearch('');
      setSupabaseValuesError(null);
      setSupabaseSkipNextValueFetch(false);
      fetchSupabaseTables();
    },
    [fetchSupabaseTables],
  );

  const handleSupabaseMentionClose = useCallback(
    (options?: { insertFallback?: boolean }) => {
      if (options?.insertFallback && supabaseMentionState && editor) {
        editor
          .chain()
          .focus()
          .insertContentAt(supabaseMentionState.range.from, '@')
          .run();
      }

      setSupabaseMentionState(null);
      setSupabaseSelectedTable(null);
      setSupabaseTables([]);
      setSupabaseColumns([]);
      setSupabaseSelectedColumn(null);
      setSupabaseValues([]);
      setSupabaseValueSearch('');
      setSupabaseTablesError(null);
      setSupabaseColumnsError(null);
      setSupabaseValuesError(null);
      setSupabaseSkipNextValueFetch(false);
      setSupabaseLastSelection(null);
      setSupabaseLastValueSequence(null);
    },
    [editor, supabaseMentionState],
  );

  const handleSupabaseTableSelect = useCallback(
    (table: SupabaseTableMetadata) => {
      if (SUPABASE_TABLE_EXCLUDE.has(table.name)) {
        return;
      }
      setSupabaseSelectedTable(table);
      setSupabaseSelectedColumn(null);
      setSupabaseColumns([]);
      setSupabaseColumnsError(null);
      setSupabaseValues([]);
      setSupabaseValuesError(null);
      setSupabaseValueSearch('');
      setSupabaseSkipNextValueFetch(false);
      setSupabaseLastSelection(null);
      setSupabaseLastValueSequence(null);
      fetchSupabaseTableColumns(table.name);
    },
    [fetchSupabaseTableColumns],
  );

  const handleSupabaseColumnSelect = useCallback(
    (column: SupabaseColumnMetadata) => {
      if (!supabaseSelectedTable) {
        return;
      }
      setSupabaseSelectedColumn(column);
      setSupabaseValues([]);
      setSupabaseValuesError(null);
      setSupabaseValueSearch('');
      setSupabaseSkipNextValueFetch(false);
      setSupabaseLastSelection(null);
      setSupabaseLastValueSequence(null);
      fetchSupabaseColumnValues(column.table, column.name, '');
    },
    [fetchSupabaseColumnValues, supabaseSelectedTable],
  );

  const handleSupabaseValueSelect = useCallback(
    (item: SupabaseValueOption) => {
      if (!supabaseMentionState) {
        return;
      }

      const dialogEntries = getRowEntries(item.row, new Set(['id']));
      setSupabaseRowDialog({
        open: true,
        entries: dialogEntries,
        table: item.table,
        rowIndex: item.rowIndex,
        row: item.row,
      });

      if (supabaseSelectedTable && supabaseSelectedColumn && supabaseColumns.length > 0) {
        const columnIndex = supabaseColumns.findIndex((column) => column.name === item.column);
        if (columnIndex !== -1) {
          setSupabaseLastSelection({
            table: supabaseSelectedTable,
            columns: supabaseColumns,
            row: item.row,
            rowIndex: item.rowIndex,
            currentColumnIndex: columnIndex,
          });
          const valueIndex = supabaseValues.findIndex(
            (value) =>
              value.table === item.table &&
              value.column === item.column &&
              value.rowIndex === item.rowIndex &&
              value.display === item.display,
          );
          if (valueIndex !== -1) {
            setSupabaseLastValueSequence({
              table: supabaseSelectedTable,
              column: supabaseSelectedColumn,
              columns: supabaseColumns,
              values: supabaseValues,
              currentIndex: valueIndex,
              searchTerm: supabaseValueSearch,
            });
          } else {
            setSupabaseLastValueSequence(null);
          }
        } else {
          setSupabaseLastSelection(null);
          setSupabaseLastValueSequence(null);
        }
      } else {
        setSupabaseLastSelection(null);
        setSupabaseLastValueSequence(null);
      }

      setSupabaseMentionState(null);
      setSupabaseSelectedTable(null);
      setSupabaseTables([]);
      setSupabaseColumns([]);
      setSupabaseSelectedColumn(null);
      setSupabaseValues([]);
      setSupabaseValueSearch('');
      setSupabaseTablesError(null);
      setSupabaseColumnsError(null);
      setSupabaseValuesError(null);
      setSupabaseSkipNextValueFetch(false);
    },
    [
      editor,
      supabaseMentionState,
      supabaseSelectedTable,
      supabaseSelectedColumn,
      supabaseColumns,
      supabaseValues,
      supabaseValueSearch,
    ],
  );

  const handleSupabaseMentionBack = useCallback(() => {
    if (supabaseSelectedColumn) {
      setSupabaseSelectedColumn(null);
      setSupabaseValues([]);
      setSupabaseValuesError(null);
      setSupabaseValueSearch('');
      setSupabaseSkipNextValueFetch(false);
      setSupabaseLastValueSequence(null);
      return;
    }
    setSupabaseSelectedTable(null);
    setSupabaseColumns([]);
    setSupabaseColumnsError(null);
    setSupabaseSelectedColumn(null);
    setSupabaseValues([]);
    setSupabaseValuesError(null);
    setSupabaseValueSearch('');
    setSupabaseSkipNextValueFetch(false);
    setSupabaseLastSelection(null);
    setSupabaseLastValueSequence(null);
  }, [supabaseSelectedColumn]);

  useEffect(() => {
    if (!supabaseMentionState) {
      return;
    }

    fetchSupabaseTables();
  }, [fetchSupabaseTables, supabaseMentionState]);

  useEffect(() => {
    if (!supabaseMentionState || !supabaseSelectedTable) {
      return;
    }

    fetchSupabaseTableColumns(supabaseSelectedTable.name);
  }, [fetchSupabaseTableColumns, supabaseMentionState, supabaseSelectedTable]);

  useEffect(() => {
    if (!supabaseMentionState || !supabaseSelectedTable || !supabaseSelectedColumn) {
      return;
    }

    if (supabaseSkipNextValueFetch) {
      setSupabaseSkipNextValueFetch(false);
      return;
    }

    const handler = setTimeout(() => {
      fetchSupabaseColumnValues(
        supabaseSelectedTable.name,
        supabaseSelectedColumn.name,
        supabaseValueSearch,
      );
    }, 250);

    return () => clearTimeout(handler);
  }, [
    fetchSupabaseColumnValues,
    supabaseMentionState,
    supabaseSelectedTable,
    supabaseSelectedColumn,
    supabaseValueSearch,
    supabaseSkipNextValueFetch,
  ]);

  const supabasePanelMode: 'tables' | 'columns' | 'values' = supabaseSelectedTable
    ? supabaseSelectedColumn
      ? 'values'
      : 'columns'
    : 'tables';

  const handleSupabaseNextRequest = useCallback(
    ({ position, range }: { position: { left: number; top: number }; range: { from: number; to: number } }) => {
      if (supabaseLastValueSequence) {
        const { table, column, columns, values, currentIndex } = supabaseLastValueSequence;
        let nextIndex = currentIndex + 1;
        let nextValue: SupabaseValueOption | undefined;

        while (nextIndex < values.length) {
          const candidate = values[nextIndex];
          if (candidate.display && candidate.display.trim().length > 0) {
            nextValue = candidate;
            break;
          }
          nextIndex++;
        }

        if (nextValue) {
          setSupabaseMentionState({ anchor: position, range });
          setSupabaseSelectedTable(table);
          setSupabaseTables((prev) => (prev.some((item) => item.name === table.name) ? prev : [...prev, table]));
          setSupabaseColumns(columns);
          setSupabaseColumnsLoading(false);
          setSupabaseColumnsError(null);
          setSupabaseSelectedColumn(column);
          setSupabaseValueSearch(supabaseLastValueSequence.searchTerm);
          setSupabaseSkipNextValueFetch(true);
          setSupabaseValues(values.slice(nextIndex));
          setSupabaseValuesLoading(false);
          setSupabaseValuesError(null);
          setSupabaseLastSelection({
            table,
            columns,
            row: nextValue.row,
            rowIndex: nextValue.rowIndex,
            currentColumnIndex: columns.findIndex((col) => col.name === column.name),
          });
          setSupabaseLastValueSequence({
            table,
            column,
            columns,
            values,
            currentIndex: nextIndex,
            searchTerm: supabaseLastValueSequence.searchTerm,
          });
          return;
        }

        setSupabaseLastValueSequence(null);
      }

      if (!supabaseLastSelection) {
        return;
      }

      const { table, columns, row, rowIndex, currentColumnIndex } = supabaseLastSelection;

      let nextIndex = currentColumnIndex + 1;
      let nextColumn: SupabaseColumnMetadata | undefined;

      while (nextIndex < columns.length) {
        const candidate = columns[nextIndex];
        const value = row[candidate.name];
        if (
          value !== null &&
          value !== undefined &&
          !(typeof value === 'string' && value.trim() === '')
        ) {
          nextColumn = candidate;
          break;
        }
        nextIndex++;
      }

      if (!nextColumn) {
        setSupabaseLastSelection(null);
        return;
      }

      const rawValue = row[nextColumn.name];
      const display =
        typeof rawValue === 'string'
          ? rawValue
          : typeof rawValue === 'number'
          ? String(rawValue)
          : JSON.stringify(rawValue);

      setSupabaseMentionState({ anchor: position, range });
      setSupabaseSelectedTable(table);
      setSupabaseTables((prev) => {
        if (prev.some((item) => item.name === table.name)) {
          return prev;
        }
        return [...prev, table];
      });
      setSupabaseColumns(columns);
      setSupabaseColumnsLoading(false);
      setSupabaseColumnsError(null);
      setSupabaseSelectedColumn(nextColumn);
      setSupabaseValueSearch('');
      setSupabaseSkipNextValueFetch(true);
      setSupabaseValues([
        {
          table: table.name,
          column: nextColumn.name,
          display,
          rawValue,
          row,
          rowIndex,
        },
      ]);
      setSupabaseValuesLoading(false);
      setSupabaseValuesError(null);
      setSupabaseLastSelection({
        table,
        columns,
        row,
        rowIndex,
        currentColumnIndex: nextIndex,
      });
    },
    [supabaseLastSelection, supabaseLastValueSequence],
  );

  // Auto-save function with debouncing
  const autoSaveContract = useCallback(async () => {
    if (!user?.id || !contractId || !contractName.trim()) {
      return;
    }

    setIsAutoSaving(true);
    try {
      const styledContent = wrapContentForStorage(contractContent);
      const { error } = await supabase
        .from('contracts')
        // @ts-ignore - Supabase type inference issue
        .update({
          contract_name: contractName.trim(),
          description: contractDescription.trim() || null,
          content: styledContent,
          variables: variables,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', contractId);

      if (error) {
        console.error('Auto-save error:', error);
      } else {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Auto-save exception:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [user?.id, contractId, contractName, contractDescription, contractContent, variables]);

  // Debounced auto-save effect
  useEffect(() => {
    // Only auto-save if we're editing an existing contract
    if (!contractId || !contractName.trim()) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveContract();
    }, 2000);

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [contractContent, contractName, contractDescription, variables, contractId, autoSaveContract]);

  useEffect(() => {
    setVariables((prev) => {
      const keyCounts = extractVariableKeysFromContent(contractContent);

      if (keyCounts.size === 0) {
        if (Object.keys(prev).length === 0) {
          return prev;
        }
        return {};
      }

      let changed = false;
      const next: Record<string, VariableEntry> = { ...prev };

      keyCounts.forEach((count, key) => {
        const existing = prev[key];
        const defaults = VARIABLE_DEFAULT_SOURCES[key as VariableKeyOptionValue];

        const nextEntry: VariableEntry = {
          descriptors: existing ? [...existing.descriptors] : [],
        };

        if (nextEntry.descriptors.length > count) {
          nextEntry.descriptors.length = count;
          changed = true;
        }

        while (nextEntry.descriptors.length < count) {
          nextEntry.descriptors.push("");
          changed = true;
        }

        if (defaults) {
          const tablePath = defaults.schema ? `${defaults.schema}.${defaults.table}` : defaults.table;
          const defaultDescriptor = `source:${tablePath}.${defaults.column}`;
          nextEntry.descriptors = nextEntry.descriptors.map((descriptor) => {
            if (descriptor && descriptor.trim().length > 0) {
              return descriptor;
            }
            changed = true;
            return defaultDescriptor;
          });
        }

        if (
          !existing ||
          existing.descriptors.length !== nextEntry.descriptors.length ||
          existing.descriptors.some((value, index) => value !== nextEntry.descriptors[index])
        ) {
          next[key] = nextEntry;
          changed = true;
        }
      });

      Object.keys(prev).forEach((key) => {
        if (!keyCounts.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [contractContent]);

  useEffect(() => {
    if (isVariableDialogOpen) {
      void loadVariableTables();
    }
  }, [isVariableDialogOpen, loadVariableTables]);

  useEffect(() => {
    if (!isVariableDialogOpen) {
      return;
    }

    if (variableSourceTable) {
      void loadVariableColumns(variableSourceTable);
    } else {
      setVariableColumns([]);
      setVariableColumnsError(null);
    }
  }, [isVariableDialogOpen, variableSourceTable, loadVariableColumns]);

  // Update "time since" display every 10 seconds
  useEffect(() => {
    if (!lastSaved) return;

    const interval = setInterval(() => {
      // Force re-render to update the time display
      setLastSaved(new Date(lastSaved));
    }, 10000);

    return () => clearInterval(interval);
  }, [lastSaved]);

  // Keyboard shortcut for Add Variable (Ctrl+Shift+H)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+H
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') {
        // Prevent default browser behavior
        event.preventDefault();
        // Only open if not already saving/loading
        if (!isSaving && !isSavingDraft && !isLoadingContract) {
          handleOpenVariableDialog();
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleOpenVariableDialog, isSaving, isSavingDraft, isLoadingContract]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/");
      return;
    }

    // Update last_seen timestamp for current user (only when tab is visible and user is active)
    let activityTimeout: NodeJS.Timeout | null = null;
    let isActive = true;

    const updateLastSeen = async () => {
      if (document.visibilityState === 'hidden' || !isActive) {
        return;
      }

      if (!user?.id) return;
      try {
        await supabase
          .from('user_profiles')
          // @ts-ignore - last_seen column may not be in types
          .update({ last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('ContractEditor: Error updating last_seen:', error);
      }
    };

    const resetActivity = () => {
      isActive = true;
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
      
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      activityTimeout = setTimeout(() => {
        isActive = false;
        console.log('ContractEditor: User inactive for 1 minute, stopping last_seen updates');
      }, 1 * 60 * 1000);
    };

    const handleMouseMove = () => resetActivity();
    const handleKeyPress = () => resetActivity();
    const handleClick = () => resetActivity();
    const handleScroll = () => resetActivity();

    resetActivity();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isActive) {
        updateLastSeen();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    const fetchProfile = async () => {
      if (!user?.id) return;

      const metaName = (user as any)?.user_metadata?.full_name as string | undefined;
      if (metaName && metaName.trim()) {
        setDisplayName(metaName.trim());
      }

      const cache = localStorage.getItem(`profile_sidebar_${user.id}`);
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (parsed?.user_name) setDisplayName(parsed.user_name);
        } catch {}
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_name, email, role, super_admin, approval_status, status, employee_id, updated_at, hold_end_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('ContractEditor: Error fetching profile:', error);
          if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
            console.log('ContractEditor: User profile not found, redirecting to login');
            try {
              await signOut();
            } catch (signOutError) {
              console.error('ContractEditor: Error signing out:', signOutError);
            }
            try {
              localStorage.removeItem(`profile_sidebar_${user.id}`);
              localStorage.removeItem(`profile_${user.id}`);
              localStorage.removeItem('currentUserRole');
              localStorage.removeItem('isSuperAdmin');
              localStorage.removeItem('isAuthenticated');
            } catch (e) {
              console.error('Error clearing cache:', e);
            }
            window.location.href = '/login?error=account_deleted';
            return;
          }
          return;
        }

        if (data) {
          const userProfile = data as UserProfile;
          setProfile(userProfile);
          setDisplayName(userProfile.user_name || metaName || userProfile.email?.split('@')[0] || 'User');

          try {
            localStorage.setItem(`profile_sidebar_${user.id}`, JSON.stringify({
              employee_id: userProfile.employee_id,
              updated_at: userProfile.updated_at,
              user_name: userProfile.user_name,
              email: userProfile.email,
              role: userProfile.role,
              super_admin: userProfile.super_admin,
              approval_status: userProfile.approval_status,
              status: userProfile.status,
              hold_end_time: userProfile.hold_end_time
            }));
          } catch (e) {
            console.error('Error updating cache:', e);
          }

          const isAdminOrSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = location.pathname;
            
            if (userProfile.approval_status === 'rejected') {
              navigate('/rejected');
              return;
            }
            
            if (userProfile.status === 'suspend') {
              navigate('/suspended');
              return;
            }
            
            if (userProfile.status === 'hold') {
              navigate('/hold');
              return;
            }
            
            if (userProfile.approval_status !== 'approved') {
              navigate('/approval-pending');
              return;
            }
          }
        } else {
          console.log('ContractEditor: User profile not found, redirecting to login');
          try {
            await signOut();
          } catch (signOutError) {
            console.error('ContractEditor: Error signing out:', signOutError);
          }
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          window.location.href = '/login?error=account_deleted';
          return;
        }
      } catch (error: any) {
        console.error('ContractEditor: Exception fetching profile:', error);
        if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
          console.log('ContractEditor: User profile not found, redirecting to login');
          try {
            await signOut();
          } catch (signOutError) {
            console.error('ContractEditor: Error signing out:', signOutError);
          }
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          window.location.href = '/login?error=account_deleted';
          return;
        }
        if (user.email) setDisplayName(user.email.split('@')[0]);
      }
    };

    fetchProfile();

    return () => {
      if (interval) clearInterval(interval);
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user?.id, authLoading, navigate, signOut, location.pathname]);

  // Load existing contract for editing
  const loadContract = useCallback(async (id: string) => {
    if (!user?.id) return;

    setIsLoadingContract(true);
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;

    const fetchContract = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          // Retry logic for network errors
          if (retryCount < maxRetries && (error.code === 'PGRST301' || error.message?.includes('fetch'))) {
            retryCount++;
            console.log(`ContractEditor: Retrying fetch (attempt ${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
            return fetchContract();
          }
          throw error;
        }

        if (data) {
          const contractData = data as ContractData;
          // Check if user has access to this contract
          const isAdminOrSuperAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.super_admin === true;
          const hasAccess = isAdminOrSuperAdmin || contractData.created_by === user.id || contractData.assigned_to === user.id;

          if (!hasAccess) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to edit this contract.",
              variant: "destructive",
            });
            navigate('/contract');
            return;
          }

          setContractPid(contractData.pid ?? null);
          setContractName(contractData.contract_name || '');
          setContractDescription((contractData as ContractData).description || '');
          setContractContent(unwrapContentFromStorage(contractData.content));
          setVariables(normalizeVariablesFromServer(contractData.variables as Record<string, any> | null));
          setLastSaved(new Date(contractData.updated_at));
        } else {
          toast({
            title: "Contract Not Found",
            description: "The contract you're trying to edit doesn't exist.",
            variant: "destructive",
          });
          navigate('/contract');
        }
      } catch (error: any) {
        console.error('Error loading contract:', error);
        if (retryCount >= maxRetries) {
          toast({
            title: "Error",
            description: error.message || "Failed to load contract. Please try again.",
            variant: "destructive",
          });
          navigate('/contract');
        }
      } finally {
        setIsLoadingContract(false);
      }
    };

    fetchContract();
  }, [user?.id, profile, navigate, toast]);

  // Load existing contract for editing when URL has id parameter
  useEffect(() => {
    if (!user?.id || !profile) return;

    const urlParams = new URLSearchParams(location.search);
    const editContractId = urlParams.get('id');
    
    if (editContractId && !contractId) {
      setContractId(editContractId);
      loadContract(editContractId);
    }
  }, [user?.id, profile, location.search, contractId, loadContract]);

  const handleSave = async () => {
    if (!contractName.trim() || !contractContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both contract name and content.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated. Please login again.",
        variant: "destructive",
      });
      return;
    }

    const styledContent = wrapContentForStorage(contractContent);
    setIsSaving(true);
    try {
      if (contractId) {
        // Update existing contract
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .update({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: styledContent,
            status: 'active',
            variables: variables,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', contractId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Contract Updated",
          description: `Contract "${contractName}" has been updated successfully.`,
        });
      } else {
        // Create new contract
        let pidToUse = contractPid;
        if (!pidToUse) {
          try {
            pidToUse = await fetchNextContractPid();
            setContractPid(pidToUse);
          } catch (pidError) {
            console.warn("ContractEditor: unable to generate contract pid", pidError);
            pidToUse = null;
          }
        }

        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .insert({
            pid: pidToUse,
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: styledContent,
            status: 'active',
            created_by: user.id,
            variables: variables,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        if (data) {
          setContractId((data as any).id ?? null);
          setContractPid((data as any).pid ?? pidToUse ?? null);
        }
        
        toast({
          title: "Contract Saved",
          description: `Contract "${contractName}" has been saved successfully.`,
        });
      }
      
      // Navigate back to contracts page
      navigate('/contract');
    } catch (error: any) {
      console.error('Error saving contract:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!contractName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a contract name to save as draft.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated. Please login again.",
        variant: "destructive",
      });
      return;
    }

    const styledContent = wrapContentForStorage(contractContent);
    setIsSavingDraft(true);
    try {
      if (contractId) {
        // Update existing contract as draft
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .update({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: styledContent || '',
            status: 'draft',
            variables: variables,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', contractId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Draft Updated",
          description: `Contract "${contractName}" has been saved as draft.`,
        });
      } else {
        // Create new draft
        let pidToUse = contractPid;
        if (!pidToUse) {
          try {
            pidToUse = await fetchNextContractPid();
            setContractPid(pidToUse);
          } catch (pidError) {
            console.warn("ContractEditor: unable to generate contract pid for draft", pidError);
            pidToUse = null;
          }
        }

        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .insert({
            pid: pidToUse,
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: styledContent || '',
            status: 'draft',
            created_by: user.id,
            variables: variables,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        if (data) {
          setContractId((data as any).id ?? null);
          setContractPid((data as any).pid ?? pidToUse ?? null);
        }
        
        toast({
          title: "Draft Saved",
          description: `Contract "${contractName}" has been saved as draft.`,
        });
      }
      
      // Navigate back to contracts page
      navigate('/contract');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handle variable insertion
  const handleAddVariable = () => {
    if (!variableKey.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select or enter a variable key.",
        variant: "destructive",
      });
      return;
    }

    // For signature, require signature type selection
    if (variableKey.trim() === 'signature' && !signatureType) {
      toast({
        title: "Signature Type Required",
        description: "Please select whether this signature is for influencer or user.",
        variant: "destructive",
      });
      return;
    }

    // For non-signature variables, check source table/column consistency
    if (variableKey.trim() !== 'signature') {
      if ((variableSourceTable && !variableSourceColumn) || (!variableSourceTable && variableSourceColumn)) {
        toast({
          title: "Incomplete source selection",
          description: "Select both table and column to link data, or leave both blank.",
          variant: "destructive",
        });
        return;
      }
    }

    // Insert variable placeholder in format {{variable_key}}
    let trimmedKey = variableKey.trim();
    
    // Special handling for signature variable - use signature.user or signature.influencer
    if (trimmedKey === 'signature' && signatureType) {
      trimmedKey = `signature.${signatureType}`;
    }
    
    // Special handling for signature variable - create a box
    let variablePlaceholder: string;
    if (variableKey.trim() === 'signature' && signatureType) {
      variablePlaceholder = `<span class="signature-box" data-signature="true" style="display: inline-block !important; width: 200px !important; height: 140px !important; border: 1px solid #9ca3af !important; background-color: transparent !important; border-radius: 3px !important; padding: 2px !important; text-align: center !important; vertical-align: middle !important; line-height: 136px !important; font-size: 10px !important; color: #6b7280 !important; box-sizing: border-box !important; margin-top: 20px !important; margin-bottom: 20px !important; margin-left: 25px !important; margin-right: 25px !important;">var[{{${trimmedKey}}}]</span>`;
    } else {
      variablePlaceholder = `<span style="background-color: #fef3c7; padding: 2px 4px; border-radius: 3px; font-weight: 500;">var[{{${trimmedKey}}}]</span>`;
    }

    if (editor) {
      // Insert as HTML - TipTap will parse it using the SignatureBox node extension
      // Add a space after to ensure spacing between boxes on the same line
      editor
        .chain()
        .focus()
        .insertContent(variablePlaceholder)
        .insertContent(' ') // Add space after signature box for same-line spacing
        .run();
    } else {
      // Fallback in case editor isn't ready yet
      setContractContent((prev) => prev + ' ' + variablePlaceholder + ' ');
    }
    
    // Store variable in state
    const descriptorParts: string[] = [];
    if (variableSourceTable && variableSourceColumn) {
      const tablePath = variableSourceSchema
        ? `${variableSourceSchema}.${variableSourceTable}`
        : variableSourceTable;
      descriptorParts.push(`source:${tablePath}.${variableSourceColumn}`);
    }
    setVariables((prev) => {
      const descriptor = descriptorParts.join(" | ");
      const existing = prev[trimmedKey];

      if (existing) {
        const descriptors = [...existing.descriptors];
        const emptyIndex = descriptors.findIndex((value) => !value || !value.trim());

        if (descriptor) {
          if (descriptors.includes(descriptor)) {
            return prev;
          }
          if (emptyIndex !== -1) {
            descriptors[emptyIndex] = descriptor;
          } else {
            descriptors.push(descriptor);
          }
        } else if (emptyIndex === -1) {
          descriptors.push("");
        }

        return {
          ...prev,
          [trimmedKey]: { descriptors },
        };
      }

      return {
        ...prev,
        [trimmedKey]: {
          descriptors: descriptor ? [descriptor] : [""],
        },
      };
    });

    toast({
      title: "Variable Added",
      description: variableSourceTable && variableSourceColumn
        ? `Variable "${trimmedKey}" linked to ${variableSourceTable}.${variableSourceColumn}.`
        : `Variable "${trimmedKey}" has been added to the document.`,
    });

    // Reset form and close dialog
    handleVariableDialogOpenChange(false);
  };

  const handleImageUpload = useCallback(async (file: File) => {
    if (!user?.id) {
      const error = new Error('You must be signed in to upload images.');
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }

    const bucket = 'contracts';
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const baseName = file.name.replace(/[^a-zA-Z0-9-.]/g, '_').replace(/\.[^/.]+$/, '') || 'image';
    const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const fileName = `${baseName}-${uniqueId}.${extension}`;
    const directory = contractId ? `contracts/${contractId}` : `drafts/${user.id}`;
    const filePath = `${directory}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found')) {
          toast({
            title: 'Storage bucket missing',
            description: "Please create a 'contracts' bucket in Supabase Storage and make it public.",
            variant: 'destructive',
          });
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Unable to retrieve uploaded image URL.');
      }

      return {
        url: urlData.publicUrl,
        alignment: 'left' as const,
        offsetX: 0,
      };
    } catch (error: any) {
      console.error('ContractEditor: image upload failed', error);
      toast({
        title: 'Image upload failed',
        description: error?.message || 'Unable to upload image right now. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [contractId, user?.id, toast]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  useEffect(() => {
    if (!supabaseRowDialog.open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSupabaseRowDialog();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [supabaseRowDialog.open, closeSupabaseRowDialog]);

  return (
    <div className="flex min-h-screen bg-[#f5f5f7]">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        {/* Canva-style Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/contract')}
                disabled={isSaving || isSavingDraft}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {contractName || 'Untitled Contract'}
                </h2>
                <p className="text-xs text-gray-500">
                  {isAutoSaving ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : lastSaved && contractId ? (
                    <span>Saved {formatTimeSince(lastSaved)}</span>
                  ) : contractId ? (
                    'Editing'
                  ) : (
                    'Creating new contract'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isSavingDraft || !contractName.trim()}
                className="text-gray-600 hover:text-gray-900"
              >
                {isSavingDraft ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isSavingDraft || !contractName.trim() || !contractContent.trim()}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-sm"
                size="sm"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar - Fixed below header with horizontal scrolling */}
        <div className="sticky top-[56px] z-20 bg-[#f8f9fa] border-b border-[#dadce0] shadow-sm overflow-x-auto scrollbar-hide">
          <div className="px-3 py-2">
            <MenuBar
              editor={editor}
              onVariableClick={handleOpenVariableDialog}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>

        <main className="px-4 py-6 pb-24 lg:pb-8 animate-fade-in">

          {/* Editor Content */}
          {isLoadingContract ? (
            <div className="flex items-center justify-center min-h-[600px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b5cf6] mx-auto mb-4"></div>
                <p className="text-gray-600 text-lg">Loading contract...</p>
                <p className="text-gray-400 text-sm mt-2">Please wait while we fetch the contract data</p>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {/* Contract Name & Description - Floating above canvas */}
              <div className="mb-6 space-y-4">
                <div>
                  <Input
                    id="contractName"
                    type="text"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="Untitled Contract"
                    disabled={isSaving || isSavingDraft}
                    required
                    className="text-2xl font-bold border-0 border-b border-transparent hover:border-gray-300 focus:border-[#8b5cf6] rounded-none px-0 h-auto py-2 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    Contract PID:{" "}
                    <span className="font-medium text-gray-700">
                      {contractPid ?? "Will be assigned on save"}
                    </span>
                  </p>
                </div>
                <div>
                  <textarea
                    id="contractDescription"
                    value={contractDescription}
                    onChange={(e) => setContractDescription(e.target.value)}
                    placeholder="Add a description..."
                    disabled={isSaving || isSavingDraft || isLoadingContract}
                    rows={2}
                    className="w-full border-0 bg-transparent px-0 py-1 text-sm text-gray-600 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 resize-none"
                  />
                </div>
              </div>

              {/* Editor Container */}
              <div 
                className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden transition-transform duration-300 origin-top" 
                style={{ 
                  minHeight: '800px',
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center'
                }}
              >
                <TiptapEditor
                  content={contractContent}
                  onChange={setContractContent}
                  placeholder="Start writing your contract here...

Use the toolbar above to format text, add headings, lists, and more."
                  onVariableClick={handleOpenVariableDialog}
                  onSupabaseMentionTrigger={handleSupabaseMentionTrigger}
                  onSupabaseNextRequest={handleSupabaseNextRequest}
                  onEditorReady={setEditor}
                  onImageUpload={handleImageUpload}
                />
              </div>

            </div>
          )}
        </main>
      </div>

      <MobileNav />

      {/* Supabase Row Sidebar */}
      {supabaseRowDialog.open &&
        createPortal(
          <aside className="fixed inset-y-0 right-0 z-[10000] w-full max-w-sm bg-white shadow-xl border-l border-gray-200 flex flex-col">
              <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {supabaseRowDialog.table ? `Row from ${supabaseRowDialog.table}` : 'Row Details'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Drag any field card into the editor to insert `Field: Value` pairs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSupabaseRowDialog}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close row details sidebar"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {supabaseRowDialog.entries.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-gray-500">
                    No data to display.
                  </div>
                ) : (
                  supabaseRowDialog.entries.map((entry, index) => {
                    const combined =
                      entry.value && entry.value.includes('\n')
                        ? `${entry.key}:\n${entry.value}`
                        : `${entry.key}: ${entry.value}`;
                    const previewText = entry.value || '';
                    return (
                      <div
                        key={`${entry.key}-${index}`}
                        className="flex flex-col gap-1 px-5 py-4 hover:bg-violet-50 transition"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', previewText);
                          if (supabaseDragPreviewRef.current) {
                            document.body.removeChild(supabaseDragPreviewRef.current);
                            supabaseDragPreviewRef.current = null;
                          }
                          const previewContainer = document.createElement('div');
                          previewContainer.style.position = 'fixed';
                          previewContainer.style.top = '-1000px';
                          previewContainer.style.left = '-1000px';
                          previewContainer.style.opacity = '1';
                          previewContainer.style.pointerEvents = 'none';
                          previewContainer.className = 'rounded-md border border-violet-100 bg-white px-3 py-2 text-gray-800 shadow-sm';
                          const pre = document.createElement('pre');
                          pre.className = 'whitespace-pre-wrap font-sans text-sm';
                          pre.textContent = previewText;
                          previewContainer.appendChild(pre);
                          document.body.appendChild(previewContainer);
                          supabaseDragPreviewRef.current = previewContainer;
                          if (event.dataTransfer) {
                            event.dataTransfer.setDragImage(
                              previewContainer,
                              previewContainer.offsetWidth / 2,
                              previewContainer.offsetHeight / 2,
                            );
                          }
                        }}
                        onDragEnd={() => {
                          if (supabaseDragPreviewRef.current) {
                            document.body.removeChild(supabaseDragPreviewRef.current);
                            supabaseDragPreviewRef.current = null;
                          }
                        }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                          {entry.key}
                        </div>
                        <div className="rounded-md border border-violet-100 bg-white px-3 py-2 text-gray-800 shadow-sm">
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {combined}
                          </pre>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-gray-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-gray-50">
                <p className="text-xs text-gray-500">
                  Tip: Drag any field into the editor or insert the entire row at once.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeSupabaseRowDialog}>
                    Close
                  </Button>
                  <Button onClick={handleInsertFullRow} disabled={!supabaseRowDialog.row}>
                    Insert Entire Row
                  </Button>
                </div>
              </div>
          </aside>,
          document.body,
        )}

      {/* Floating Zoom Controls - Bottom Left */}
      <div className="fixed bottom-4 left-8 lg:left-60 z-20 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 50}
          className="h-2 w-4 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <button
          onClick={handleResetZoom}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 min-w-[3.5rem] hover:bg-gray-100 rounded transition-colors"
          title="Reset Zoom"
        >
          {zoomLevel}%
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 200}
          className="h-2 w-4 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          title="Zoom In"
        >
          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      {/* Variable Dialog */}
      <Dialog open={isVariableDialogOpen} onOpenChange={handleVariableDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Custom Variable</DialogTitle>
            <DialogDescription>
              Add a variable placeholder that can be updated later. The variable will be inserted at the current cursor position in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="variableKeySelect">Variable Key *</Label>
              <Select value={variableKeyOption} onValueChange={handleVariableKeyOptionChange}>
                <SelectTrigger id="variableKeySelect" className="w-full">
                  <SelectValue placeholder="Select a variable key" />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_KEY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {variableKeyOption === 'custom' ? (
                <>
                  <Input
                    id="variableKeyCustom"
                    type="text"
                    value={variableKey}
                    onChange={(e) => setVariableKey(e.target.value)}
                    placeholder="Enter a custom key (e.g., client_name)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && variableKey.trim()) {
                        handleAddVariable();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Placeholder preview:&nbsp;
                    <span className="font-mono text-[11px] text-indigo-600">
                      {`var[{{${variableKey.trim() || 'your_key'}}}]`}
                    </span>
                  </p>
                </>
              ) : variableKeyOption === 'signature' && signatureType ? (
                <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs font-semibold text-indigo-600">
                  {`var[{{signature.${signatureType}}}]`}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs font-semibold text-indigo-600">
                  {`var[{{${variableKey}}}]`}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Select a preset placeholder or choose Custom to define your own key.
              </p>
            </div>
            {/* Show signature type selector for signature variable, otherwise show source table/column */}
            {variableKeyOption === 'signature' ? (
              <div className="space-y-2">
                <Label>Signature Type *</Label>
                <Select
                  value={signatureType || undefined}
                  onValueChange={(value: 'influencer' | 'user') => setSignatureType(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select signature type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select whether this signature is for the influencer or user.
                </p>
                {signatureType && (
                  <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs font-semibold text-indigo-600">
                    {`var[{{signature.${signatureType}}}]`}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Source Table (Optional)</Label>
                  <Select
                    value={variableSourceTable || undefined}
                    onValueChange={(value) => {
                      setVariableSourceTable(value);
                      setVariableSourceColumn('');
                      const selected = variableTables.find((table) => table.name === value);
                      setVariableSourceSchema(selected?.schema ?? '');
                    }}
                    disabled={variableTablesLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          variableTablesLoading ? "Loading tables..." : "Select a table"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {variableTablesLoading ? (
                        <SelectItem value="__loading" disabled>
                          Loading tables...
                        </SelectItem>
                      ) : variableTables.length ? (
                        variableTables.map((table) => (
                          <SelectItem key={table.name} value={table.name}>
                            {table.schema ? `${table.schema}.${table.name}` : table.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no_tables" disabled>
                          {variableTablesError ?? "No tables available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the table that provides this dynamic value.
                  </p>
                  {!variableTablesLoading && variableTablesError && (
                    <p className="text-xs text-red-500">{variableTablesError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Source Column (Optional)</Label>
                  <Select
                    value={variableSourceColumn || undefined}
                    onValueChange={setVariableSourceColumn}
                    disabled={!variableSourceTable || variableColumnsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          variableSourceTable
                            ? variableColumnsLoading
                              ? "Loading columns..."
                              : "Select a column"
                            : "Select a table first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {variableSourceTable ? (
                        variableColumnsLoading ? (
                          <SelectItem value="__loading" disabled>
                            Loading columns...
                          </SelectItem>
                        ) : variableColumns.length ? (
                          variableColumns.map((column) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name}
                              {column.dataType ? ` (${column.dataType})` : ""}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__no_columns" disabled>
                            {variableColumnsError ?? "No columns found"}
                          </SelectItem>
                        )
                      ) : (
                        <SelectItem value="__no_table" disabled>
                          Select a table first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pick the column to map this variable to. Leave blank to manage the value manually.
                  </p>
                  {!variableColumnsLoading && variableColumnsError && (
                    <p className="text-xs text-red-500">{variableColumnsError}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleVariableDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVariable}
              disabled={!variableKey.trim()}
            >
              Add Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {supabaseMentionState && (
        <SupabaseMentionPanel
          anchor={supabaseMentionState.anchor}
          mode={supabasePanelMode}
          tables={supabaseTables}
          tablesLoading={supabaseTablesLoading}
          tablesError={supabaseTablesError}
          selectedTable={supabaseSelectedTable}
          onTableSelect={handleSupabaseTableSelect}
          columns={supabaseColumns}
          columnsLoading={supabaseColumnsLoading}
          columnsError={supabaseColumnsError}
          onColumnSelect={handleSupabaseColumnSelect}
          selectedColumn={supabaseSelectedColumn}
          values={supabaseValues}
          valuesLoading={supabaseValuesLoading}
          valuesError={supabaseValuesError}
          valueSearch={supabaseValueSearch}
          onValueSearchChange={setSupabaseValueSearch}
          onValueSelect={handleSupabaseValueSelect}
          onBack={handleSupabaseMentionBack}
          onClose={handleSupabaseMentionClose}
        />
      )}
    </div>
  );
};

export default ContractEditor;

