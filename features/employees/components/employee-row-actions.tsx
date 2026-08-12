"use client";

import { useState } from "react";
import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmployeeSummary } from "@/features/employees/server/serialize";
import { personDisplayName } from "@/shared/lib/person";

type Props = {
  employee: EmployeeSummary;
  canEdit: boolean;
  canDeactivate: boolean;
  isSelf: boolean;
  busy: boolean;
  onEdit: () => void;
  onResetPin: () => void | Promise<void>;
  onDeactivate: () => void | Promise<void>;
  onReactivate: () => void | Promise<void>;
};

export function EmployeeRowActions({
  employee,
  canEdit,
  canDeactivate,
  isSelf,
  busy,
  onEdit,
  onResetPin,
  onDeactivate,
  onReactivate,
}: Props) {
  const [open, setOpen] = useState(false);
  const showOverflow = canEdit || (canDeactivate && !isSelf);
  if (!canEdit && !showOverflow) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function run(action: () => void | Promise<void>) {
    setOpen(false);
    await action();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-navy hover:bg-brand/10"
          disabled={busy}
          title="Edit employee"
          aria-label={`Edit ${employee.name ?? employee.unitId}`}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}

      {showOverflow ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-muted hover:text-navy"
              disabled={busy}
              title="More actions"
              aria-label={`More actions for ${employee.name ?? employee.unitId}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate normal-case">
              {personDisplayName({
                name: employee.name,
                mobile: employee.mobile,
                unitId: employee.unitId,
              })}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canEdit ? (
              <DropdownMenuItem
                disabled={busy}
                onSelect={() => {
                  void run(onResetPin);
                }}
              >
                <KeyRound />
                Reset PIN
              </DropdownMenuItem>
            ) : null}
            {canEdit && canDeactivate && !isSelf ? <DropdownMenuSeparator /> : null}
            {canDeactivate && !isSelf ? (
              employee.isActive ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy}
                  onSelect={() => {
                    if (
                      !window.confirm(
                        `Deactivate ${employee.name ?? employee.unitId}? They will not be able to sign in.`
                      )
                    ) {
                      return;
                    }
                    void run(onDeactivate);
                  }}
                >
                  <UserX />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={() => {
                    void run(onReactivate);
                  }}
                >
                  <UserCheck />
                  Reactivate
                </DropdownMenuItem>
              )
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
