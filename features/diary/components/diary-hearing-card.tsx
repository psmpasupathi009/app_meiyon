"use client";

import Link from "next/link";
import { Briefcase, MoreHorizontal, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { PersonChip } from "@/shared/components/user/person-chip";
import { cn } from "@/lib/utils/cn";
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_VARIANT,
  normalizeCaseStatus,
} from "@meiyon/config";

export type DiaryItem = {
  hearingUnitId: string;
  hearingDate: string;
  purpose: string | null;
  notes: string | null;
  smsSentAt: string | null;
  caseUnitId: string;
  caseNumber: string | null;
  caseStatus: string | null;
  stage: string | null;
  clientName: string | null;
  clientUnitId: string | null;
  courtName: string | null;
  primaryAdvocateMobile: string | null;
  advocateName: string | null;
};

type Props = {
  item: DiaryItem;
  canEdit: boolean;
  onAdjourn: () => void;
};

export function DiaryHearingCard({ item, canEdit, onAdjourn }: Props) {
  const title = item.caseNumber || item.caseUnitId;
  const status = item.caseStatus ? normalizeCaseStatus(item.caseStatus) : null;

  return (
    <li
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        "print:rounded-none print:border print:border-border print:p-3 print:shadow-none"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-navy">
              {title}
              {item.clientName ? (
                <span className="font-medium text-foreground">
                  {" "}
                  · {item.clientName}
                </span>
              ) : null}
            </h3>
            {status ? (
              <Badge
                variant={CASE_STATUS_VARIANT[status] ?? "outline"}
                className="print:border print:border-border"
              >
                {CASE_STATUS_LABEL[status]}
              </Badge>
            ) : null}
            {item.smsSentAt ? (
              <Badge
                variant="success"
                className="print:hidden"
              >
                SMS Sent
              </Badge>
            ) : (
              <Badge
                variant="warning"
                className="print:hidden"
              >
                SMS Pending
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {item.purpose ? item.purpose : "Purpose not set"}
            {item.stage ? ` · ${item.stage}` : ""}
          </p>

          {item.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground print:line-clamp-none">
              {item.notes}
            </p>
          ) : null}

          {item.advocateName || item.primaryAdvocateMobile ? (
            <div className="print:hidden">
              <PersonChip
                name={item.advocateName}
                mobile={item.primaryAdvocateMobile}
              />
            </div>
          ) : null}

          <div className="print:hidden">
            <UnitIdBadge value={item.caseUnitId} />
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 print:hidden sm:w-auto sm:flex-row sm:items-center">
          <Button asChild type="button" size="sm" variant="outline" className="h-10 w-full sm:h-9 sm:w-auto">
            <Link href={`/cases/${item.caseUnitId}`}>
              <Scale className="size-3.5" />
              Open case
            </Link>
          </Button>

          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 self-end text-muted-foreground hover:text-navy sm:size-9 sm:self-auto"
                  aria-label={`More actions for ${title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate normal-case">
                  {title}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/cases/${item.caseUnitId}`}>
                    <Scale />
                    Open case
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAdjourn}>
                  <Briefcase />
                  Adjourn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </li>
  );
}
