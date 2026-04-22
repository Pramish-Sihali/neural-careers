import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import type { Application, ApplicationStatus } from "@/lib/types/database";

export interface ApplicationCreateData {
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  phone?: string | null;
  yearsOfExperience?: number | null;
  coverLetter?: string | null;
  resumeUrl: string;
  resumeText: string;
}

export async function createApplication(data: ApplicationCreateData): Promise<Application> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("applications")
    .insert({
      id: crypto.randomUUID(),
      ...data,
      status: "APPLIED",
      version: 0,
      createdAt: now,
      updatedAt: now,
    })
    .select("*, job:jobs(*)")
    .single();
  if (error) throw error;
  return parseApplicationRow(row as Record<string, unknown>);
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseApplicationRow(data as Record<string, unknown>) : null;
}

export async function getApplicationByEmailAndJob(
  candidateEmail: string,
  jobId: string
): Promise<Application | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("candidateEmail", candidateEmail)
    .eq("jobId", jobId)
    .maybeSingle();
  if (error) throw error;
  return data ? parseApplicationRow(data as Record<string, unknown>) : null;
}

export async function listApplications(filters?: {
  status?: ApplicationStatus;
  jobId?: string;
}): Promise<Application[]> {
  let query = supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .order("createdAt", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.jobId) query = query.eq("jobId", filters.jobId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => parseApplicationRow(row as Record<string, unknown>));
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("*, job:jobs(*)")
    .single();
  if (error) throw error;
  return parseApplicationRow(data as Record<string, unknown>);
}
