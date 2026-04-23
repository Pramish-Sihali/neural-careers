"use client";

import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// The viewer imports pdfjs-dist via its peer dep resolution, which npm dedupes
// to the already-installed v5.6.205 (required by unpdf). We pin the worker to
// the exact same version on a CDN so the document API and the worker agree —
// pdfjs rejects any mismatch at runtime.
const PDFJS_WORKER_URL =
  "https://unpkg.com/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs";

export function PdfViewerInner({ signedUrl }: { signedUrl: string }) {
  const layout = defaultLayoutPlugin();

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-muted">
      <Worker workerUrl={PDFJS_WORKER_URL}>
        <Viewer
          fileUrl={signedUrl}
          plugins={[layout]}
          defaultScale={SpecialZoomLevel.PageWidth}
        />
      </Worker>
    </div>
  );
}
