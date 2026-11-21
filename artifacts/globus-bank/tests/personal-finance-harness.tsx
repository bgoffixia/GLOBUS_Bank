import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { DashboardPage } from "../src/pages/bank-pages";
import { CompactExpenseTracker, PersonalFinancePage } from "../src/pages/personal-finance/personal-finance";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function PersonalFinanceViewportHarness() {
  return (
    <Router>
      <main className="h-dvh min-h-0 w-full overflow-x-clip overflow-y-auto px-3 py-3 sm:px-6">
        <DashboardPage />
        <PersonalFinancePage />
        <CompactExpenseTracker />
      </main>
    </Router>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Personal finance viewport harness root is missing.");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PersonalFinanceViewportHarness />
    </QueryClientProvider>
  </StrictMode>,
);
