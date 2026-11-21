import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "320px mobile", width: 320, height: 740 },
  { name: "360px mobile", width: 360, height: 780 },
  { name: "390px mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const sampleExpense = {
  id: "5d1e0ac3-983f-4b2d-8d75-41e2366fb13e",
  kind: "expense",
  title: "Market shopping",
  category: "Food",
  currency: "USD",
  amountMinor: "4250",
  targetAmountMinor: null,
  recordDate: "2026-11-19",
  dueDate: null,
  frequency: null,
  status: "paid",
  notes: null,
  createdAt: "2026-11-19T09:00:00.000Z",
  updatedAt: "2026-11-19T09:00:00.000Z",
};

const overview = {
  period: "month",
  currencySummaries: [{
    currency: "USD",
    expensesMinor: "4250",
    savingsBalanceMinor: "150000",
    savingsTargetMinor: "500000",
    investmentValueMinor: "83000",
    loanBalanceMinor: "0",
    unpaidBillsMinor: "12000",
  }],
  expenseTrend: [{ period: "2026-11-19", currency: "USD", amountMinor: "4250" }],
  expenseCategories: [{ category: "Food", currency: "USD", amountMinor: "4250" }],
  recentExpenses: [sampleExpense],
};

const dashboard = {
  profile: {
    firstName: "Sample",
    accountStatus: "active",
    testingMode: true,
    accountTier: { name: "Standard 🏦" },
  },
  referenceCurrency: "USD",
  wallets: [{ id: "wallet-usd", currency: "USD", available: "1250.00", status: "active" }],
  recentTransactions: [],
};

async function mockFinanceApi(page: Page) {
  await page.route("**/api/bank/dashboard", async (route) => {
    await route.fulfill({ json: dashboard });
  });
  await page.route("**/api/bank/personal-finance/**", async (route) => {
    const request = route.request();
    if (request.url().includes("/overview")) {
      await route.fulfill({ json: overview });
      return;
    }
    if (request.method() === "POST" || request.method() === "PATCH") {
      await route.fulfill({ json: sampleExpense });
      return;
    }
    if (request.method() === "DELETE") {
      await route.fulfill({ json: { deleted: true } });
      return;
    }
    await route.fulfill({
      json: { records: [sampleExpense], total: 1, page: 1, pageSize: 8 },
    });
  });
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  const state = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(state.document, `document overflow at ${width}px`).toBeLessThanOrEqual(state.viewport);
  expect(state.body, `body overflow at ${width}px`).toBeLessThanOrEqual(state.viewport);
}

test.describe("personal finance responsive workspace", () => {
  for (const viewport of viewports) {
    test(`summary, records, expense tracker, and editor fit at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockFinanceApi(page);
      await page.goto("/tests/personal-finance-harness.html", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-workspace")).toBeVisible();
      await expect(page.getByTestId("dashboard-testing-mode-warning")).toBeVisible();
      await expect(page.getByTestId("dashboard-account-tier-badge")).toContainText("Standard");
      await expect(page.getByRole("heading", { name: "Financial overview" })).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByRole("heading", { name: "Expense tracker" })).toBeVisible();
      await expect(page.getByText("Market shopping").first()).toBeVisible();
      await expectNoHorizontalOverflow(page, viewport.width);
      const dashboardBoxes = await page.getByTestId("dashboard-content-grid").locator(":scope > section").evaluateAll((sections) =>
        sections.map((section) => {
          const rect = section.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }),
      );
      for (let first = 0; first < dashboardBoxes.length; first += 1) {
        for (let second = first + 1; second < dashboardBoxes.length; second += 1) {
          const overlapX = Math.min(dashboardBoxes[first].right, dashboardBoxes[second].right) -
            Math.max(dashboardBoxes[first].left, dashboardBoxes[second].left);
          const overlapY = Math.min(dashboardBoxes[first].bottom, dashboardBoxes[second].bottom) -
            Math.max(dashboardBoxes[first].top, dashboardBoxes[second].top);
          expect(overlapX > 1 && overlapY > 1, `dashboard cards overlap at ${viewport.width}px`).toBe(false);
        }
      }
      const workspaceScroller = page.locator("#root main");
      const scrollState = await workspaceScroller.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(scrollState.overflowY).toBe("auto");
      expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
      const scrollTop = await workspaceScroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      });
      expect(scrollTop).toBeGreaterThan(0);

      const record = page.locator(".pf-record-card").first();
      const children = await record.evaluate((element) =>
        Array.from(element.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }),
      );
      for (let first = 0; first < children.length; first += 1) {
        for (let second = first + 1; second < children.length; second += 1) {
          const overlapX = Math.min(children[first].right, children[second].right) -
            Math.max(children[first].left, children[second].left);
          const overlapY = Math.min(children[first].bottom, children[second].bottom) -
            Math.max(children[first].top, children[second].top);
          expect(overlapX > 1 && overlapY > 1, `record controls overlap at ${viewport.width}px`).toBe(false);
        }
      }

      await page.getByRole("button", { name: "Add record" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const dialogSize = await dialog.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: getComputedStyle(element).overflowY,
      }));
      expect(["auto", "scroll"]).toContain(dialogSize.overflowY);
      expect(dialogSize.scrollHeight).toBeGreaterThanOrEqual(dialogSize.clientHeight);
      await dialog.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(dialog.getByRole("button", { name: "Save record" })).toBeVisible();
      await expectNoHorizontalOverflow(page, viewport.width);
    });
  }
});
