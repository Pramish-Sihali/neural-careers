import { supabase } from "@/lib/supabase";
import { parseJobRow } from "@/lib/types/database";
import type { Job } from "@/lib/types/database";

export async function listActiveJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("isActive", true)
    .order("createdAt", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => parseJobRow(row as Record<string, unknown>));
}

export async function getJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseJobRow(data as Record<string, unknown>) : null;
}

export async function createJob(
  data: Omit<Job, "id" | "createdAt" | "updatedAt">
): Promise<Job> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("jobs")
    .insert({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
    .select()
    .single();
  if (error) throw error;
  return parseJobRow(row as Record<string, unknown>);
}
