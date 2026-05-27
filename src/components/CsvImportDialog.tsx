import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ---------- CSV parser ---------- */

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/* ---------- Column mapping config ---------- */

const COLUMNS: Record<string, { label: string; key: string }[]> = {
  contacts: [
    { label: 'First Name', key: 'first_name' },
    { label: 'Last Name', key: 'last_name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Title', key: 'title' },
    { label: 'Source', key: 'source' },
  ],
  companies: [
    { label: 'Name', key: 'name' },
    { label: 'Domain', key: 'domain' },
    { label: 'Industry', key: 'industry' },
    { label: 'Size', key: 'size' },
    { label: 'Website', key: 'website' },
  ],
  leads: [
    { label: 'Name', key: 'name' },
    { label: 'Company Name', key: 'company_name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Source', key: 'source' },
    { label: 'Status', key: 'status' },
    { label: 'Notes', key: 'notes' },
  ],
};

const SKIP_VALUE = '__skip__';
const CREATE_VALUE = '__create__';

/* ---------- Types ---------- */

interface CsvImportDialogProps {
  table: 'contacts' | 'companies' | 'leads';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

/* ---------- Component ---------- */

export function CsvImportDialog({
  table,
  open,
  onOpenChange,
  onComplete,
}: CsvImportDialogProps) {
  const [step, setStep] = useState(1);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const { data: customFields = [] } = useQuery({
    queryKey: ['custom-fields', table],
    queryFn: () => api.get(`/settings/custom-fields/${table}`),
    enabled: open && table === 'leads', // Enable for leads, can expand later
  });

  const dynamicCols = customFields.map((cf: any) => ({ label: cf.label, key: `custom_fields.${cf.name}` }));
  const dbColumns = [...(COLUMNS[table] ?? []), ...dynamicCols];

  /* --- Reset --- */
  const reset = () => {
    setStep(1);
    setCsvHeaders([]);
    setCsvRows([]);
    setFileName('');
    setMapping({});
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  /* --- File handling --- */
  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map by matching column names (case-insensitive)
      const autoMapping: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().replace(/[\s_-]+/g, '_');
        const match = dbColumns.find(
          (c) => c.key === normalized || c.label.toLowerCase().replace(/\s+/g, '_') === normalized,
        );
        if (match) autoMapping[i] = match.key;
      });
      setMapping(autoMapping);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dbColumns],
  );

  /* --- Mapping helpers --- */
  const handleCreateCustomField = async (csvIndex: number) => {
    const header = csvHeaders[csvIndex];
    if (!header) return;
    try {
      const key = header.toLowerCase().replace(/[\s_-]+/g, '_');
      await api.post("/settings/custom-fields", {
        entity_type: table,
        name: key,
        label: header
      });
      await qc.invalidateQueries({ queryKey: ["custom-fields", table] });
      setMapping((prev) => ({ ...prev, [csvIndex]: `custom_fields.${key}` }));
      toast.success(`Created custom field: ${header}`);
    } catch (error: any) {
      toast.error("Failed to create custom field. It might already exist.");
    }
  };

  const setColumnMapping = (csvIndex: number, dbKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (dbKey === SKIP_VALUE) {
        delete next[csvIndex];
      } else {
        next[csvIndex] = dbKey;
      }
      return next;
    });
  };

  /* --- Build mapped data --- */
  const buildMappedRows = (): Record<string, any>[] => {
    return csvRows.map((row) => {
      const obj: Record<string, any> = { custom_fields: {} };
      Object.entries(mapping).forEach(([csvIdx, dbKey]) => {
        const val = row[Number(csvIdx)];
        if (val !== undefined && val !== '') {
          if (dbKey.startsWith('custom_fields.')) {
            obj.custom_fields[dbKey.split('.')[1]] = val;
          } else {
            obj[dbKey] = val;
          }
        }
      });
      return obj;
    });
  };

  /* --- Import --- */
  const handleImport = async () => {
    const rows = buildMappedRows().filter((r) => Object.keys(r).length > 0 || Object.keys(r.custom_fields).length > 0);
    if (rows.length === 0) return;

    setImporting(true);
    setProgress({ done: 0, total: rows.length });
    let success = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      try {
        const endpoint = table === 'leads' ? '/leads/bulk' : `/${table}`;
        await api.post(endpoint, batch);
        success += batch.length;
      } catch {
        errors += batch.length;
      }
      setProgress({ done: Math.min(i + batchSize, rows.length), total: rows.length });
    }

    setResult({ success, errors });
    setImporting(false);
    setStep(4);
  };

  /* --- Preview data --- */
  const previewRows = buildMappedRows().slice(0, 5);
  const mappedDbKeys = Object.values(mapping);
  const mappedColumns = dbColumns.filter((c) => mappedDbKeys.includes(c.key));

  /* --- Step indicator --- */
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Map Columns' },
    { num: 3, label: 'Preview' },
    { num: 4, label: 'Import' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import {table === 'contacts' ? 'Contacts' : table === 'companies' ? 'Companies' : 'Leads'}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import records.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-4">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${step >= s.num ? 'bg-primary' : 'bg-border'}`}
                />
              )}
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold ${
                  step > s.num
                    ? 'bg-primary text-primary-foreground'
                    : step === s.num
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  step >= s.num ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop a CSV file here, or click to browse
              </p>
              <Label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Choose File
                  </span>
                </Button>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map each CSV column to the corresponding database field.
            </p>
            <div className="space-y-3">
              {csvHeaders.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 text-sm font-medium truncate bg-muted px-3 py-2 rounded">
                    {header}
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                  <div className="flex-1">
                    <Select
                      value={mapping[i] ?? SKIP_VALUE}
                      onValueChange={(val) => {
                        if (val === CREATE_VALUE) {
                          handleCreateCustomField(i);
                        } else {
                          setColumnMapping(i, val);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Skip column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_VALUE}>
                          <span className="text-muted-foreground">Skip column</span>
                        </SelectItem>
                        {table === 'leads' && (
                          <SelectItem value={CREATE_VALUE} className="text-primary font-medium">
                            + Create Custom Field
                          </SelectItem>
                        )}
                        {dbColumns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={Object.keys(mapping).length === 0}
              >
                Next: Preview
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview of first {Math.min(5, csvRows.length)} rows with your column mapping.
            </p>
            {mappedColumns.length > 0 && previewRows.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      {mappedColumns.map((col) => (
                        <th
                          key={col.key}
                          className="text-left px-3 py-2 font-medium"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, r) => (
                      <tr key={r} className="border-t">
                        {mappedColumns.map((col) => {
                          const val = col.key.startsWith('custom_fields.') 
                            ? row.custom_fields?.[col.key.split('.')[1]] 
                            : row[col.key];
                          return (
                            <td key={col.key} className="px-3 py-2">
                              {val || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data to preview. Go back and check your column mapping.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Total rows to import: {csvRows.length}
            </p>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={mappedColumns.length === 0}>
                Start Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div className="space-y-4 text-center py-6">
            {importing ? (
              <>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Importing {progress.done} of {progress.total}…
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        progress.total > 0
                          ? (progress.done / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </>
            ) : result ? (
              <>
                <div className="flex items-center justify-center">
                  {result.errors === 0 ? (
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold">Import Complete</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-green-600 dark:text-green-400">
                    ✓ {result.success} records imported successfully
                  </p>
                  {result.errors > 0 && (
                    <p className="text-red-600 dark:text-red-400">
                      ✗ {result.errors} records failed
                    </p>
                  )}
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      reset();
                      handleOpenChange(false);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      onComplete();
                      reset();
                      handleOpenChange(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
