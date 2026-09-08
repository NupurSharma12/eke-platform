'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { DOCUMENT_TYPES, DocumentType, SourceMetadata } from '@/packages/shared-types';

/**
 * Registration-only: uploads a file to /api/eke/upload-material and
 * shows the resulting sourceDocumentId + status. Deliberately does
 * not show chapters/concepts/question patterns — parsing, chapter
 * detection, and concept extraction are all later milestones. See
 * app/api/eke/upload-material/route.ts's own doc comment.
 */
export default function UploadPage() {
  const { activeChild } = useApp();
  const router = useRouter();

  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('textbook');
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sourceDocumentId: string; sourceMetadata: SourceMetadata } | null>(null);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  const upload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.set('file', file);
      form.set('documentType', documentType);
      if (gradeId) form.set('gradeId', gradeId);
      if (subjectId) form.set('subjectId', subjectId);

      const res = await fetch('/api/eke/upload-material', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload material.');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload material.');
    } finally {
      setUploading(false);
    }
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]" /></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">📚</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Add Learning Material</h1>
            <p className="opacity-90 mt-1">Upload a textbook, worksheet, or other material for any grade or subject.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-primary/10 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Grade (optional)</label>
              <input
                type="number"
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value)}
                placeholder="e.g. 2"
                className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Subject (optional)</label>
              <input
                type="text"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                placeholder="e.g. EVS"
                className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full sm:w-auto border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">File (PDF, JPEG, or PNG)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5"
            />
          </div>

          <button
            onClick={upload}
            disabled={!file || uploading}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">{error}</div>
          )}

          {result && (
            <div className="bg-accent/10 text-foreground rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                Upload successful
              </div>
              <div className="text-sm text-muted-foreground">Source: <span className="font-mono">{result.sourceDocumentId}</span></div>
              <div className="text-sm text-muted-foreground">Status: Registered</div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
