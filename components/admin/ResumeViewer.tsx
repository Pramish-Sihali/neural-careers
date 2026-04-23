"use client";

import dynamic from "next/dynamic";
import { ExternalLink, FileText } from "lucide-react";

const PdfViewer = dynamic(() => import("./PdfViewerInner").then((m) => m.PdfViewerInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
      Loading viewer…
    </div>
  ),
});

interface Props {
  signedUrl: string | null;
  fallbackMessage?: string;
}

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
      <PdfViewer signedUrl={signedUrl} />
    </div>
  );
}
