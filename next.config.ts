import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // CampusOS serves live campus data. Nothing in this app may be statically
  // cached: the AI agent and the dashboard must always observe current
  // backend state (see README.md "Important" and PROBLEM_STATEMENT.md).
  // Route-level `dynamic`/`revalidate` settings are declared per route in
  // later phases; this block keeps the build itself cache-neutral.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
