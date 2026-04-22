"use client";

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

export function SendBotButton({
  applicationId,
  interviewStatus,
}: {
  applicationId: string;
  interviewStatus: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");

  if (interviewStatus === "COMPLETED") return null;

  async function handleClick() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/trigger-notetaker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(body.error ?? "Failed to send bot");
      } else {
        setState("success");
        setMessage(body.message ?? "Bot sent successfully");
        setTimeout(() => {
          setState("idle");
          setMessage("");
        }, 8000);
      }
    } catch {
      setState("error");
      setMessage("Network error — could not reach server");
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={state === "loading" || state === "success"}
        className={[
          "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          state === "success"
            ? "bg-green-100 text-green-700 cursor-default"
            : state === "loading"
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        ].join(" ")}
      >
        {state === "loading"
          ? "Sending..."
          : state === "success"
          ? "Bot Sent ✓"
          : "Send Bot Now"}
      </button>
      {state === "error" && message && (
        <p className="text-sm text-red-600">{message}</p>
      )}
      {state === "success" && message && (
        <p className="text-sm text-green-600">{message}</p>
      )}
    </div>
  );
}
