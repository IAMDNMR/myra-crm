import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Upload, File, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export function DocumentList({ dealId, contactId }: { dealId?: string; contactId?: string }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryKey = ["documents", dealId, contactId];

  const { data: docs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const q = new URLSearchParams();
      if (dealId) q.set("deal_id", dealId);
      if (contactId) q.set("contact_id", contactId);
      return await api.get(`/documents?${q.toString()}`);
    }
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    if (dealId) fd.append("deal_id", dealId);
    if (contactId) fd.append("contact_id", contactId);

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) throw new Error("Upload failed");
      
      toast.success("File uploaded");
      qc.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await api.delete(`/documents/${id}`);
      qc.invalidateQueries({ queryKey });
      toast.success("File deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Files & Documents</h3>
        {!isReadOnly && (
          <div>
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Upload className="w-4 h-4 mr-2" />
              {busy ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading files...</p>
      ) : docs.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-md text-muted-foreground bg-muted/20">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No files uploaded yet.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {docs.map((d: any) => (
            <div key={d.id} className="flex justify-between items-center p-3 border rounded-md group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-accent rounded-md"><File className="w-4 h-4 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(d.size_bytes)} · {fmtDate(d.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={`${API_BASE_URL}/documents/${d.id}/download`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                {!isReadOnly && (
                  <button 
                    onClick={() => deleteDoc(d.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
