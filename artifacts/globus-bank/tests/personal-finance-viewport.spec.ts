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

const financeReport = {
  period: "month",
  ledgerSummaries: [
    {
      walletId: "9b51bdb0-80a9-44eb-a2d9-73d923968001",
      currency: "USD",
      inflowMinor: "12000",
      outflowMinor: "2500",
      netMinor: "9500",
    },
    {
      walletId: "9b51bdb0-80a9-44eb-a2d9-73d923968002",
      currency: "USD",
      inflowMinor: "2000",
      outflowMinor: "700",
      netMinor: "1300",
    },
  ],
  ledgerTrend: [
    {
      walletId: "9b51bdb0-80a9-44eb-a2d9-73d923968001",
      period: "2026-11-20",
      currency: "USD",
      inflowMinor: "12000",
      outflowMinor: "2500",
    },
    {
      walletId: "9b51bdb0-80a9-44eb-a2d9-73d923968002",
      period: "2026-11-20",
      currency: "USD",
      inflowMinor: "2000",
      outflowMinor: "700",
    },
  ],
  recentActivity: [],
  accountSummaries: [],
  billSummaries: [],
  loanSummaries: [],
};
financeReport.ledgerSummaries.push(...Array.from({ length: 12 }, (_, index) => ({
  walletId: `9b51bdb0-80a9-44eb-a2d9-73d923968${String(9000 + index)}`,
  currency: (["USD", "EUR", "GBP", "CAD"] as const)[index % 4],
  inflowMinor: String(1000 + index),
  outflowMinor: String(500 + index),
  netMinor: String(500 + index),
})));

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
  await page.route("**/api/bank/personal-finance/report**", async (route) => {
    await route.fulfill({ json: financeReport });
  });
  await page.route("**/api/bank/personal-finance/accounts", async (route) => {
    await route.fulfill({ json: route.request().method() === "GET" ? [] : {
      id: "tracker-id",
      type: "savings",
      name: "Savings tracker",
      currency: "USD",
      currentValueMinor: "0",
      targetAmountMinor: null,
      openedOn: "2026-11-19",
      status: "active",
      notes: null,
      createdAt: "2026-11-19T09:00:00.000Z",
      updatedAt: "2026-11-19T09:00:00.000Z",
    } });
  });
  await page.route("**/api/bank/personal-finance/loan-applications", async (route) => {
    await route.fulfill({ json: route.request().method() === "GET" ? [] : {
      id: "loan-id",
      requestedAmountMinor: "10000",
      currency: "USD",
      purpose: "Education",
      termMonths: 12,
      status: "submitted",
      submittedAt: "2026-11-19T09:00:00.000Z",
      createdAt: "2026-11-19T09:00:00.000Z",
      updatedAt: "2026-11-19T09:00:00.000Z",
    } });
  });
  await page.route("**/api/bank/personal-finance/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/report")) {
      await route.fulfill({ json: financeReport });
      return;
    }
    if (pathname.endsWith("/accounts")) {
      await route.fulfill({ json: request.method() === "GET" ? [] : {
        id: "tracker-id",
        type: "savings",
        name: "Savings tracker",
        currency: "USD",
        currentValueMinor: "0",
        targetAmountMinor: null,
        openedOn: "2026-11-19",
        status: "active",
        notes: null,
        createdAt: "2026-11-19T09:00:00.000Z",
        updatedAt: "2026-11-19T09:00:00.000Z",
      } });
      return;
    }
    if (pathname.endsWith("/loan-applications")) {
      await route.fulfill({ json: request.method() === "GET" ? [] : {
        id: "loan-id",
        requestedAmountMinor: "10000",
        currency: "USD",
        purpose: "Education",
        termMonths: 12,
        status: "submitted",
        submittedAt: "2026-11-19T09:00:00.000Z",
        createdAt: "2026-11-19T09:00:00.000Z",
        updatedAt: "2026-11-19T09:00:00.000Z",
      } });
      return;
    }
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
    test(`ledger widget, personal records, and editor fit at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockFinanceApi(page);
      await page.goto("/tests/personal-finance-harness.html", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-workspace")).toBeVisible();
      await expect(page.getByTestId("dashboard-testing-mode-warning")).toBeVisible();
      await expect(page.getByTestId("link-dashboard-setup-vault")).toHaveAttribute("href", "/private-vault");
      await expect(page.getByTestId("dashboard-account-tier-badge")).toContainText("Standard");
      await expect(page.getByRole("heading", { name: "Financial overview" })).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByRole("heading", { name: "Account activity · income & expenses" })).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByTestId("dashboard-ledger-summary")).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByTestId("dashboard-ledger-USD-8001")).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByTestId("dashboard-ledger-USD-8002")).toBeVisible();
      await expect(page.getByTestId("dashboard-workspace").getByTestId("link-financial-overview")).toHaveAttribute("href", "/financial-overview");
      await expect(page.getByTestId("dashboard-workspace").getByTestId("button-add-dashboard-expense")).toHaveCount(0);
      await expect(page.getByTestId("dashboard-workspace").getByText("Market shopping")).toHaveCount(0);
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
      const balanceCard = page.getByTestId("dashboard-sticky-balance");
      await expect(balanceCard).toHaveCSS("position", "sticky");
      await expect(balanceCard).toHaveCSS("top", "0px");
      const scrollState = await workspaceScroller.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(scrollState.overflowY).toBe("auto");
      expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
      const scrollTop = await workspaceScroller.evaluate((element) => {
        element.scrollTop = 120;
        return element.scrollTop;
      });
      expect(scrollTop).toBeGreaterThan(0);
      const [mainBox, stickyBalanceBox] = await Promise.all([
        workspaceScroller.boundingBox(),
        balanceCard.boundingBox(),
      ]);
      expect(mainBox).not.toBeNull();
      expect(stickyBalanceBox).not.toBeNull();
      expect(stickyBalanceBox!.y).toBeGreaterThanOrEqual(mainBox!.y - 1);
      expect(stickyBalanceBox!.y).toBeLessThanOrEqual(mainBox!.y + 24);

      const ledgerScroller = page.getByTestId("dashboard-ledger-scroll");
      const ledgerState = await ledgerScroller.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(ledgerState.overflowY).toBe("auto");
      if (viewport.width === 320) {
        expect(ledgerState.scrollHeight).toBeGreaterThan(ledgerState.clientHeight);
        await ledgerScroller.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        const lastSummary = await page.getByTestId("dashboard-workspace").getByTestId("dashboard-ledger-CAD-9011").boundingBox();
        const ledgerBox = await ledgerScroller.boundingBox();
        expect(lastSummary).not.toBeNull();
        expect(ledgerBox).not.toBeNull();
        expect(lastSummary!.y + lastSummary!.height).toBeLessThanOrEqual(ledgerBox!.y + ledgerBox!.height + 1);
      }

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
      await dialog.getByTestId("button-close-record-dialog").click();
      await page.getByTestId("button-add-account-tracker").click();
      const trackerDialog = page.getByRole("dialog", { name: "Add a tracker" });
      await expect(trackerDialog.getByTestId("input-account-target")).toBeVisible();
      await trackerDialog.getByTestId("select-account-type").selectOption("investment");
      await expect(trackerDialog.getByTestId("input-account-target")).toHaveCount(0);
      await expectNoHorizontalOverflow(page, viewport.width);
    });
  }
});
