"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "select"
  | "tags";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  /** Half-width on desktop, so related fields sit side by side. */
  half?: boolean;
}

export type FormValues = Record<string, string>;

/**
 * One dialog drives create and edit for all five systems.
 *
 * Server-side validation is the source of truth: a failed submit renders the
 * API's message and, for Zod issues, maps them onto the offending fields
 * rather than showing a generic "something went wrong".
 */
export function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: FormValues;
  submitLabel?: string;
  onSubmit: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const blank = React.useMemo(() => {
    const v: FormValues = {};
    for (const f of fields) v[f.name] = "";
    return v;
  }, [fields]);

  const [values, setValues] = React.useState<FormValues>(blank);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Reset whenever the dialog opens, so a cancelled edit never leaks into the
  // next one.
  React.useEffect(() => {
    if (open) {
      setValues({ ...blank, ...(initial ?? {}) });
      setFormError(null);
      setFieldErrors({});
    }
  }, [open, initial, blank]);

  const set = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (values[f.name] ?? "").trim();
      if (raw === "") continue; // omitted -> service keeps the existing value
      if (f.type === "number") payload[f.name] = Number(raw);
      else if (f.type === "tags")
        payload[f.name] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      else payload[f.name] = raw;
    }

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        const issues = err.details;
        if (Array.isArray(issues)) {
          const mapped: Record<string, string> = {};
          for (const i of issues as { path?: unknown[]; message?: string }[]) {
            const key = Array.isArray(i.path) ? String(i.path[0] ?? "") : "";
            if (key && i.message) mapped[key] = i.message;
          }
          setFieldErrors(mapped);
        }
      } else {
        setFormError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const err = fieldErrors[f.name];
              return (
                <div
                  key={f.name}
                  className={cn("space-y-1.5", !f.half && "sm:col-span-2")}
                >
                  <Label htmlFor={f.name}>
                    {f.label}
                    {f.required ? (
                      <span className="ml-0.5 text-destructive">*</span>
                    ) : null}
                  </Label>

                  {f.type === "textarea" ? (
                    <Textarea
                      id={f.name}
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <Select
                      id={f.name}
                      value={values[f.name] ?? ""}
                      onChange={(e) => set(f.name, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={f.name}
                      type={
                        f.type === "number"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : f.type === "time"
                              ? "time"
                              : "text"
                      }
                      value={values[f.name] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  )}

                  {err ? (
                    <p className="text-xs text-destructive">{err}</p>
                  ) : f.help ? (
                    <p className="text-xs text-muted-foreground">{f.help}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
