import Link from "next/link";
import { MapPin, Briefcase, DollarSign } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface JobCardProps {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
}

const EMPLOYMENT_TYPE_LABELS: Record<JobCardProps["employmentType"], string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (!min && !max) return null;
  const sym = currency === "USD" ? "$" : (currency ?? "");
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max!)}`;
  return null;
}

export function JobCard({
  id,
  title,
  department,
  location,
  employmentType,
  salaryMin,
  salaryMax,
  salaryCurrency,
}: JobCardProps) {
  const salary = formatSalary(salaryMin, salaryMax, salaryCurrency);

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug">{title}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {EMPLOYMENT_TYPE_LABELS[employmentType]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground font-medium">{department}</p>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {location}
          </span>
          {salary && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              {salary}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            {EMPLOYMENT_TYPE_LABELS[employmentType]}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={`/jobs/${id}`}>View details</Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link href={`/jobs/${id}#apply`}>Apply now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
