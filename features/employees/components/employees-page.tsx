"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { ImportDialog } from "@/shared/components/data/import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import { Download } from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { EmployeeSummary } from "@/features/employees/server/serialize";
import { EmployeeFormDialog } from "@/features/employees/components/employee-form-dialog";
import { EmployeeRowActions } from "@/features/employees/components/employee-row-actions";
import { ROLE_LABELS, roleLabel } from "@meiyon/config";
import type { UserRole } from "@prisma/client";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/lib/utils/cn";
import { PersonChip } from "@/shared/components/user/person-chip";

type ListResponse = {
  data: EmployeeSummary[];
  meta: { page: number; pageSize: number; total: number };
};

function formatLastLogin(iso: string | null) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const ROLE_FILTER_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[])
  .filter((value) => value !== "client")
  .map((value) => ({
    value,
    label: ROLE_LABELS[value],
  }));

export function EmployeesPage({ user }: { user: PublicUser }) {
  const can = (action: string) => user.permissions.includes(`employees.${action}`);
  const canExport = user.permissions.includes("reports.view");
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<EmployeeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeSummary | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (roleFilter !== "all") params.set("role", roleFilter);
    const { ok, data } = await apiFetch<ListResponse>(`/api/employees?${params.toString()}`);
    setLoading(false);
    if (!ok) {
      toast.error(getErrorMessage(data as Record<string, unknown>, "Failed to load employees"));
      return;
    }
    setRows((data as unknown as ListResponse).data ?? []);
    setTotal((data as unknown as ListResponse).meta?.total ?? 0);
  }, [page, debouncedSearch, statusFilter, roleFilter]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [load]);

  async function handleAction(unitId: string, action: "deactivate" | "reactivate" | "force-reset-pin") {
    setActionBusyId(unitId);
    const { ok, data } = await apiFetch(`/api/employees/${unitId}/${action}`, { method: "POST" });
    setActionBusyId(null);
    if (!ok) {
      toast.error(getErrorMessage(data as Record<string, unknown>, "Action failed"));
      return;
    }
    toast.success(
      action === "deactivate"
        ? "Employee deactivated"
        : action === "reactivate"
          ? "Employee reactivated"
          : "PIN reset — employee must set up a new PIN"
    );
    void load();
  }

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <section>
      <PageHeader
        title="Employees"
        description="Staff directory — designation is the job title; roles control app access."
        actions={
          <>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const result = await apiDownload(
                    "/api/exports?type=employees",
                    "employees.xlsx"
                  );
                  if (!result.ok) toast.error(result.error ?? "Export failed");
                }}
              >
                <Download className="size-4" />
                Export Excel
              </Button>
            ) : null}
            {can("create") ? (
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
            ) : null}
            {can("create") ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add employee
              </Button>
            ) : null}
          </>
        }
      />

      <DataToolbar
        search={
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search name, mobile, ID, designation…"
            className="w-full"
          />
        }
        filters={
          <>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setPage(1);
                setStatusFilter(v as "all" | "active" | "inactive");
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setPage(1);
                setRoleFilter(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {!loading && rows.length === 0 ? (
        <EmptyState
          title="No employees found"
          description={
            debouncedSearch || statusFilter !== "all" || roleFilter !== "all"
              ? "Try clearing filters or search."
              : "Add your first employee to get started."
          }
          action={
            can("create") && !debouncedSearch && statusFilter === "all" && roleFilter === "all" ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add employee
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>
              {loading
                ? "Loading…"
                : total === 0
                  ? "No results"
                  : `Showing ${showingFrom}–${showingTo} of ${total}`}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="hidden lg:table-cell">ID</TableHead>
                <TableHead className="hidden md:table-cell">Mobile</TableHead>
                <TableHead className="hidden lg:table-cell">Designation</TableHead>
                <TableHead className="hidden sm:table-cell">Roles</TableHead>
                <TableHead className="hidden md:table-cell">Access</TableHead>
                <TableHead className="hidden lg:table-cell">Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={8}>
                        <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((emp) => (
                    <TableRow key={emp.unitId} className={cn(!emp.isActive && "opacity-70")}>
                      <TableCell>
                        <div className="min-w-0 space-y-1">
                          <PersonChip
                            name={emp.displayName || emp.name}
                            photoUrl={emp.photoUrl}
                            mobile={emp.mobile}
                            unitId={emp.unitId}
                            subtitle={emp.email || emp.designation || undefined}
                          />
                          <div className="flex flex-wrap gap-1 sm:hidden">
                            {emp.roles.slice(0, 1).map((r) => (
                              <Badge key={r} variant="outline" className="normal-case">
                                {roleLabel(r)}
                              </Badge>
                            ))}
                            {emp.roles.length > 1 ? (
                              <Badge variant="muted" className="normal-case">
                                +{emp.roles.length - 1}
                              </Badge>
                            ) : null}
                            <Badge variant={emp.isActive ? "success" : "muted"}>
                              {emp.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <UnitIdBadge value={emp.unitId} />
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap md:table-cell">
                        +91 {emp.mobile}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {emp.designation ? (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                            {emp.designation}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {emp.roles.map((r) => (
                            <Badge key={r} variant="outline" className="normal-case">
                              {roleLabel(r)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={emp.isActive ? "success" : "muted"}>
                            {emp.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={emp.hasPin ? "outline" : "warning"} className="normal-case">
                            {emp.hasPin ? "PIN set" : "Setup needed"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {formatLastLogin(emp.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <EmployeeRowActions
                          employee={emp}
                          canEdit={can("edit")}
                          canDeactivate={can("deactivate")}
                          isSelf={emp.unitId === user.unitId}
                          busy={actionBusyId === emp.unitId}
                          onEdit={() => {
                            setEditing(emp);
                            setFormOpen(true);
                          }}
                          onResetPin={() => handleAction(emp.unitId, "force-reset-pin")}
                          onDeactivate={() => handleAction(emp.unitId, "deactivate")}
                          onReactivate={() => handleAction(emp.unitId, "reactivate")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        canAssignAdmin={user.roles.includes("admin")}
        onSaved={load}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import employees"
        endpoint="/api/employees/import"
        sampleHref="/samples/employees.sample.csv"
        columnsHint="Required: mobile, name, designation. Optional unitId to update. Roles come from designation defaults."
        onImported={load}
      />
    </section>
  );
}
