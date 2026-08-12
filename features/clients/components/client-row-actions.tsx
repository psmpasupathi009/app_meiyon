"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, MoreHorizontal, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientSummary } from "@/features/clients/server/serialize";

type Props = {
  client: ClientSummary;
  canEdit: boolean;
  onEdit: () => void;
};

export function ClientRowActions({ client, canEdit, onEdit }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-navy hover:bg-brand/10"
          title="Edit client"
          aria-label={`Edit ${client.name}`}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-muted hover:text-navy"
            title="More actions"
            aria-label={`More actions for ${client.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate normal-case">
            {client.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/clients/${client.unitId}`}>
              <UserRound />
              Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/cases?clientUnitId=${client.unitId}`}>
              <Briefcase />
              Cases
            </Link>
          </DropdownMenuItem>
          {canEdit ? (
            <DropdownMenuItem
              onSelect={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil />
              Edit
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
