"use client";

import { useState } from "react";
import { BatchScanButton } from "./BatchScanButton";
import { NewApplicationsTable, type NewApplicationRow } from "./NewApplicationsTable";
import { PipelineTable, type PipelineRow } from "./PipelineTable";
import {
  InterviewActivityTable,
  type ActivityRow,
} from "./InterviewActivityTable";
import type { ApplicationStatus } from "@/lib/types/database";

interface ScreenResult {
  fitScore: number;
  recommendation: string;
}

interface Props {
  initialNewApps: NewApplicationRow[];
  initialPipeline: PipelineRow[];
  activityRows: ActivityRow[];
}

export function AdminPipelineClient({ initialNewApps, initialPipeline, activityRows }: Props) {
  const [newApps, setNewApps] = useState(initialNewApps);
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [screeningIds, setScreeningIds] = useState<Set<string>>(new Set());

  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

  async function screenOne(app: NewApplicationRow): Promise<void> {
    setScreeningIds((prev) => new Set([...prev, app.id]));
    try {
      const res = await fetch(`/api/admin/applications/${app.id}/screen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      if (!res.ok) throw new Error("Failed");
      const result = (await res.json()) as ScreenResult;

      setNewApps((prev) => prev.filter((a) => a.id !== app.id));
      setPipeline((prev) => [
        {
          id: app.id,
          candidateName: app.candidateName,
          candidateEmail: app.candidateEmail,
          status: "SCREENED" as ApplicationStatus,
          fitScore: result.fitScore ?? null,
          jobTitle: app.jobTitle,
          createdAt: app.createdAt,
        },
        ...prev,
      ]);
    } catch {
      // row stays in table; spinner stops
    } finally {
      setScreeningIds((prev) => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  }

  async function handleBatchScan(): Promise<void> {
    const toScreen = [...newApps]; // snapshot so additions mid-scan aren't included
    for (const app of toScreen) {
      await screenOne(app);
    }
  }

  const unscreenedCount = newApps.filter((a) => !screeningIds.has(a.id)).length;

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">New Applications</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {newApps.length} unscreened application{newApps.length !== 1 ? "s" : ""}
            </p>
          </div>
          <BatchScanButton
            count={unscreenedCount}
            isRunning={screeningIds.size > 0}
            onBatchScan={handleBatchScan}
          />
        </div>
        <NewApplicationsTable
          data={newApps}
          screeningIds={screeningIds}
          onScreenOne={screenOne}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Candidate Pipeline</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pipeline.length} screened candidate{pipeline.length !== 1 ? "s" : ""}
          </p>
        </div>
        <PipelineTable data={pipeline} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Interview activity</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live status of every candidate past the screen stage — updates every 30s.
          </p>
        </div>
        <InterviewActivityTable rows={activityRows} />
      </section>
    </>
  );
}
