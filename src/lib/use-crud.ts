"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "./api-client";
import { useToast } from "@/components/common/Toast";

/**
 * One CRUD hook for all five systems.
 *
 * Every mutation invalidates the whole cache rather than surgically patching
 * one list. It costs an extra request and buys the guarantee the app is judged
 * on: after any add, edit or delete, every view — including the overview
 * counts — reflects the new backend state with no manual refresh.
 */
export function useCrud<T>(
  resource: "schedules" | "rooms" | "events" | "announcements" | "assignments",
  filters: Record<string, unknown> = {},
  labels: { singular: string } = { singular: "Record" },
) {
  const qc = useQueryClient();
  const toast = useToast();

  const invalidate = () => qc.invalidateQueries();

  const list = useQuery({
    queryKey: [resource, filters],
    queryFn: () => api.get<T[]>(`/${resource}${qs(filters)}`),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => api.post<T>(`/${resource}`, body),
    onSuccess: () => {
      invalidate();
      toast.success(`${labels.singular} created`);
    },
    onError: (e: Error) => toast.error("Could not create", e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.patch<T>(`/${resource}/${id}`, body),
    onSuccess: () => {
      invalidate();
      toast.success(`${labels.singular} updated`);
    },
    onError: (e: Error) => toast.error("Could not update", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/${resource}/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success(`${labels.singular} deleted`);
    },
    onError: (e: Error) => toast.error("Could not delete", e.message),
  });

  return { list, create, update, remove, invalidate };
}

/** Invalidate everything — used by nested actions (bookings, registrations). */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
