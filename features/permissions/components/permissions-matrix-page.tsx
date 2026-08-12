"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import {
  actionLabel,
  defaultAllowed,
  moduleLabel,
  ROLE_BLURBS,
  roleLabel,
} from "@meiyon/config";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

type Catalog = { module: string; action: string }[];
type MatrixRow = {
  role: string;
  permissions: { module: string; action: string; allowed: boolean }[];
};
type MatrixResponse = {
  catalog: Catalog;
  roles: string[];
  matrix: MatrixRow[];
  seeded: boolean;
};

function cellKey(role: string, module: string, action: string) {
  return `${role}.${module}.${action}`;
}

function gridsEqual(a: Record<string, boolean>, b: Record<string, boolean>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Boolean(a[k]) !== Boolean(b[k])) return false;
  }
  return true;
}

export function PermissionsMatrixPage({ user }: { user: PublicUser }) {
  const canEdit = user.permissions.includes("permissions.edit");

  const [catalog, setCatalog] = useState<Catalog>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [grid, setGrid] = useState<Record<string, boolean>>({});
  const [savedGrid, setSavedGrid] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSeeded, setJustSeeded] = useState(false);
  const [query, setQuery] = useState("");
  const [focusRole, setFocusRole] = useState<string | "all">("all");

  const dirty = useMemo(() => !gridsEqual(grid, savedGrid), [grid, savedGrid]);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch<MatrixResponse>("/api/permissions/matrix");
    setLoading(false);
    if (!ok) {
      toast.error(getErrorMessage(data as Record<string, unknown>, "Failed to load matrix"));
      return;
    }
    const res = data as unknown as MatrixResponse;
    setCatalog(res.catalog);
    setRoles(res.roles);
    setJustSeeded(Boolean(res.seeded));
    const next: Record<string, boolean> = {};
    for (const row of res.matrix) {
      for (const perm of row.permissions) {
        next[cellKey(row.role, perm.module, perm.action)] = perm.allowed;
      }
    }
    setGrid(next);
    setSavedGrid(next);
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (roles.length === 0) return;
    const mq = window.matchMedia("(max-width: 767px)");
    function preferSingleRole() {
      if (!mq.matches) return;
      setFocusRole((prev) => {
        if (prev !== "all") return prev;
        return roles.find((r) => r !== "admin") ?? roles[0] ?? "all";
      });
    }
    preferSingleRole();
    mq.addEventListener("change", preferSingleRole);
    return () => mq.removeEventListener("change", preferSingleRole);
  }, [roles]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function isAllowed(role: string, module: string, action: string) {
    if (role === "admin") return true;
    return Boolean(grid[cellKey(role, module, action)]);
  }

  function toggle(role: string, module: string, action: string) {
    if (!canEdit || role === "admin") return;
    const k = cellKey(role, module, action);
    setGrid((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  function setModuleForRole(role: string, module: string, allowed: boolean) {
    if (!canEdit || role === "admin") return;
    setGrid((prev) => {
      const next = { ...prev };
      for (const item of catalog.filter((c) => c.module === module)) {
        next[cellKey(role, module, item.action)] = allowed;
      }
      return next;
    });
  }

  function applyOfficeDefaults() {
    if (!canEdit) return;
    const next: Record<string, boolean> = {};
    for (const role of roles) {
      for (const { module, action } of catalog) {
        next[cellKey(role, module, action)] =
          role === "admin" ? true : defaultAllowed(role as UserRole, module, action);
      }
    }
    setGrid(next);
    toast.message("Defaults loaded — click Save to apply");
  }

  function discardChanges() {
    setGrid(savedGrid);
    toast.message("Changes discarded");
  }

  async function handleSave() {
    setSaving(true);
    const rows = roles.flatMap((role) =>
      catalog.map(({ module, action }) => ({
        role,
        module,
        action,
        allowed: role === "admin" ? true : Boolean(grid[cellKey(role, module, action)]),
      }))
    );
    const { ok, data } = await apiFetch("/api/permissions/matrix", {
      method: "PUT",
      json: { rows },
    });
    setSaving(false);
    if (!ok) {
      toast.error(getErrorMessage(data as Record<string, unknown>, "Failed to save matrix"));
      return;
    }
    setSavedGrid(grid);
    setJustSeeded(false);
    toast.success("Permission matrix saved");
  }

  const modules = useMemo(() => Array.from(new Set(catalog.map((c) => c.module))), [catalog]);

  const q = query.trim().toLowerCase();
  const filteredModules = useMemo(() => {
    if (!q) return modules;
    return modules.filter((module) => {
      const modHit = moduleLabel(module).toLowerCase().includes(q) || module.includes(q);
      if (modHit) return true;
      return catalog.some(
        (c) =>
          c.module === module &&
          (actionLabel(c.action).toLowerCase().includes(q) || c.action.includes(q))
      );
    });
  }, [modules, catalog, q]);

  const visibleRoles = focusRole === "all" ? roles : roles.filter((r) => r === focusRole);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of roles) {
      counts[role] =
        role === "admin"
          ? catalog.length
          : catalog.filter((c) => grid[cellKey(role, c.module, c.action)]).length;
    }
    return counts;
  }, [roles, catalog, grid]);

  return (
    <section>
      <PageHeader
        title="Permissions"
        description="Roles control what people can do in the app. Job titles are set on each employee as Designation. Admin always has full access."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading || saving || !dirty}
                onClick={discardChanges}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || saving}
                onClick={applyOfficeDefaults}
              >
                Load defaults
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving || loading || !dirty}>
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </Button>
            </div>
          ) : undefined
        }
      />

      {justSeeded ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Default permissions were written automatically so the office is not locked out. Review and
          save if you need changes.
        </div>
      ) : null}

      {dirty ? (
        <div className="mb-4 rounded-lg border border-navy/20 bg-secondary px-4 py-3 text-sm text-navy">
          You have unsaved changes. Staff will keep their previous access until you save.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              <button
                type="button"
                onClick={() => setFocusRole("all")}
                className={cn(
                  "hidden shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:inline-flex",
                  focusRole === "all"
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:text-navy"
                )}
              >
                All roles
              </button>
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFocusRole(role)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    focusRole === role
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:text-navy"
                  )}
                >
                  {roleLabel(role)}
                  <span className={cn("ml-1.5", focusRole === role ? "text-white/70" : "")}>
                    {roleCounts[role] ?? 0}/{catalog.length}
                  </span>
                </button>
              ))}
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter modules or actions…"
              className="w-full lg:max-w-xs"
            />
          </div>

          {focusRole !== "all" ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-navy">{roleLabel(focusRole)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ROLE_BLURBS[focusRole as UserRole] ?? ""}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="hidden gap-3 sm:grid-cols-2 md:grid lg:grid-cols-3 xl:grid-cols-5">
              {roles.map((role) => (
                <Card key={role}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy">{roleLabel(role)}</p>
                      <Badge variant={role === "admin" ? "gold" : "muted"}>
                        {roleCounts[role] ?? 0}/{catalog.length}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ROLE_BLURBS[role as UserRole] ?? ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules match that filter.</p>
          ) : (
            filteredModules.map((module) => {
              const actions = catalog.filter((c) => c.module === module);
              return (
                <Card key={module} className="overflow-hidden">
                  <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-navy">{moduleLabel(module)}</h2>
                      <p className="text-xs text-muted-foreground">{actions.length} actions</p>
                    </div>
                    {canEdit && focusRole !== "all" && focusRole !== "admin" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setModuleForRole(focusRole, module, true)}
                        >
                          Grant all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setModuleForRole(focusRole, module, false)}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Mobile: single-role stacked toggles */}
                  {focusRole !== "all" ? (
                    <ul className="divide-y divide-border/60 md:hidden">
                      {actions.map(({ action }) => {
                        const allowed = isAllowed(focusRole, module, action);
                        const locked = !canEdit || focusRole === "admin";
                        return (
                          <li
                            key={action}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-navy">
                                {actionLabel(action)}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {module}.{action}
                              </p>
                            </div>
                            <Checkbox
                              checked={allowed}
                              disabled={locked}
                              onCheckedChange={() =>
                                toggle(focusRole, module, action)
                              }
                              aria-label={`${roleLabel(focusRole)} ${actionLabel(action)} on ${moduleLabel(module)}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted-foreground md:hidden">
                      Select a role above to edit permissions on this device.
                    </p>
                  )}

                  {/* Desktop: multi-role matrix */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-160 text-sm">
                      <thead>
                        <tr className="border-b border-border/80 text-left">
                          <th className="sticky left-0 z-10 bg-card px-4 py-3 font-medium text-muted-foreground">
                            Action
                          </th>
                          {visibleRoles.map((role) => (
                            <th
                              key={role}
                              className="px-3 py-3 text-center font-medium text-muted-foreground"
                            >
                              <div>{roleLabel(role)}</div>
                              {canEdit && role !== "admin" ? (
                                <button
                                  type="button"
                                  className="mt-1 text-[11px] font-normal text-navy hover:underline"
                                  onClick={() => setModuleForRole(role, module, true)}
                                >
                                  All
                                </button>
                              ) : null}
                              {canEdit && role !== "admin" ? (
                                <span className="mx-1 text-[11px] text-muted-foreground">·</span>
                              ) : null}
                              {canEdit && role !== "admin" ? (
                                <button
                                  type="button"
                                  className="mt-1 text-[11px] font-normal text-muted-foreground hover:underline"
                                  onClick={() => setModuleForRole(role, module, false)}
                                >
                                  None
                                </button>
                              ) : null}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {actions.map(({ action }) => (
                          <tr key={action} className="border-b border-border/60 last:border-0">
                            <td className="sticky left-0 z-10 bg-card px-4 py-3">
                              <div className="font-medium text-navy">{actionLabel(action)}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {module}.{action}
                              </div>
                            </td>
                            {visibleRoles.map((role) => {
                              const allowed = isAllowed(role, module, action);
                              const locked = !canEdit || role === "admin";
                              return (
                                <td
                                  key={role}
                                  className={cn(
                                    "px-3 py-3 text-center",
                                    allowed ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""
                                  )}
                                >
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={allowed}
                                      disabled={locked}
                                      onCheckedChange={() => toggle(role, module, action)}
                                      aria-label={`${roleLabel(role)} ${actionLabel(action)} on ${moduleLabel(module)}`}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })
          )}

          {!canEdit ? (
            <p className="text-sm text-muted-foreground">
              You can view the matrix. Ask an admin for `permissions.edit` to change it.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
