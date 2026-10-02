import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StockPilot — Inventory Management" },
      { name: "description", content: "Simple, polished inventory management for growing teams." },
      { property: "og:title", content: "StockPilot — Inventory Management" },
      { property: "og:description", content: "Simple, polished inventory management for growing teams." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
