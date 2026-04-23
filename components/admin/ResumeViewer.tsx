"use client";

import { ExternalLink, FileText } from "lucide-react";

interface Props {
  signedUrl: string | null;
  fallbackMessage?: string;
}

/**
 * Renders the candidate resume inline via the browser's native PDF viewer.
 *
 * We intentionally use a raw <iframe> pointed at the Supabase signed URL
 * rather than @react-pdf-viewer — that library targets pdfjs-dist v2/v3 but
 * our project ships v5 (required by unpdf for DEV-02 server-side parsing),
 * and the mismatch fires a TypeError on renderTextLayer at runtime. Chrome,
 * Edge and Firefox ship a capable PDF viewer with working text selection,
 * search and navigation, so the browser-native path is the simpler and more
 * reliable choice. The #toolbar=0 fragment hides the top Chrome bar so the
 * viewer blends into the tab panel; users who want the full browser chrome
 * can still click "Open in new tab".
 */
export function ResumeViewer({ signedUrl, fallbackMessage = "File unavailable" }: Props) {
  if (!signedUrl) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        <div className="text-center">
          <FileText className="mx-auto mb-2 h-6 w-6" />
          {fallbackMessage}
        </div>
      </div>
    );
  }

  const iframeSrc = `${signedUrl}#toolbar=1&navpanes=0&view=FitH`;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <iframe
        src={iframeSrc}
        title="Candidate resume"
        className="h-[70vh] w-full rounded-md border bg-muted"
      />
    </div>
  );
}
