import Link from "next/link";
import { Briefcase, LayoutDashboard, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Niural Hiring</h1>
        <p className="text-muted-foreground text-lg">
          AI-powered end-to-end candidate onboarding system
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8">
          <Link
            href="/jobs"
            className="flex items-center gap-4 rounded-xl border bg-card p-6 text-left hover:bg-accent transition-colors"
          >
            <div className="rounded-lg bg-primary/10 p-3">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Career Portal</p>
              <p className="text-sm text-muted-foreground">Browse open roles &amp; apply</p>
            </div>
          </Link>

          <Link
            href="/admin/applications"
            className="flex items-center gap-4 rounded-xl border bg-card p-6 text-left hover:bg-accent transition-colors"
          >
            <div className="rounded-lg bg-purple-500/10 p-3">
              <LayoutDashboard className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold">Admin Dashboard</p>
              <p className="text-sm text-muted-foreground">Candidate pipeline &amp; screening</p>
            </div>
          </Link>
        </div>

        <div className="pt-4">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Users className="h-4 w-4" />
            View all open positions →
          </Link>
        </div>
      </div>
    </main>
  );
}
