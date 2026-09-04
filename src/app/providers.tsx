"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/common/Toast";

/**
 * Client-side data layer.
 *
 * `staleTime: 0` and `refetchOnWindowFocus` are deliberate: the dashboard must
 * always show current backend state. A cached list that survives an edit is
 * exactly the failure this app is judged on.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnMount: "always",
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
