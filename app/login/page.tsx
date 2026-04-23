import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Admin sign-in · Niural",
};

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const redirectTo = next && next.startsWith("/admin") ? next : "/admin/applications";

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground text-base font-bold">
            N
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold">Niural</p>
            <p className="text-xs text-muted-foreground">Hiring console</p>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-bold tracking-tight">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Use any email + password to enter the admin workspace.
        </p>

        <LoginForm redirectTo={redirectTo} />

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          Mock sign-in for the take-home demo — no credentials are checked.
          Real auth (Supabase Auth / NextAuth) is out of scope for this demo.{" "}
          <Link href="/" className="underline hover:text-foreground">
            Back to site
          </Link>
        </p>
      </div>
    </main>
  );
}
