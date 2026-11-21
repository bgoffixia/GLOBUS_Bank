import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateBankFinanceLoanApplicationBody,
  CreateBankFinanceLoanApplicationResponse,
  CreateBankFinancialAccountBody,
  CreateBankFinancialAccountResponse,
  GetBankFinanceReportQueryParams,
  GetBankFinanceReportResponse,
  ListBankFinanceLoanApplicationsResponse,
  ListBankFinancialAccountsResponse,
  UpdateBankFinancialAccountBody,
  UpdateBankFinancialAccountParams,
  UpdateBankFinancialAccountResponse,
  WithdrawBankFinanceLoanApplicationBody,
  WithdrawBankFinanceLoanApplicationParams,
  WithdrawBankFinanceLoanApplicationResponse,
} from "@workspace/api-zod";
import { ensureBankUser } from "../lib/bank";
import {
  financeLoanApplicationResponse,
  financialAccountResponse,
  FinanceWorkspaceValidationError,
  mergeFinancialAccountUpdate,
  normalizeFinanceLoanApplication,
  normalizeFinancialAccount,
} from "../lib/finance-workspace";
import {
  drizzleFinanceWorkspaceStore,
  type FinanceWorkspaceStore,
} from "../lib/finance-workspace-store";

type RouterDependencies = {
  store?: FinanceWorkspaceStore;
  resolveOwner?: (clerkUserId: string) => Promise<{ id: string }>;
};

async function resolveAuthenticatedOwner(
  req: Request,
  res: Response,
  resolver: NonNullable<RouterDependencies["resolveOwner"]>,
) {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to access your finance workspace." });
    return null;
  }
  try {
    return await resolver(clerkUserId);
  } catch {
    res.status(503).json({
      error: "Your Globus account could not be verified. Try again shortly.",
    });
    return null;
  }
}

export function createBankFinanceWorkspaceRouter({
  store = drizzleFinanceWorkspaceStore,
  resolveOwner = async (clerkUserId) => {
    const user = await ensureBankUser(clerkUserId);
    return { id: user.id };
  },
}: RouterDependencies = {}) {
  const router = Router();

  router.get("/bank/personal-finance/report", async (req, res): Promise<void> => {
    const query = GetBankFinanceReportQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
    if (!owner) return;

    try {
      res.json(
        GetBankFinanceReportResponse.parse(
          await store.report(owner.id, query.data.period),
        ),
      );
    } catch {
      res.status(500).json({ error: "Your finance report could not be loaded." });
    }
  });

  router.get(
    "/bank/personal-finance/accounts",
    async (req, res): Promise<void> => {
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        res.json(
          ListBankFinancialAccountsResponse.parse(
            (await store.listAccounts(owner.id)).map(financialAccountResponse),
          ),
        );
      } catch {
        res.status(500).json({ error: "Your finance accounts could not be loaded." });
      }
    },
  );

  router.post(
    "/bank/personal-finance/accounts",
    async (req, res): Promise<void> => {
      const parsed = CreateBankFinancialAccountBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const account = await store.createAccount(
          owner.id,
          normalizeFinancialAccount(parsed.data),
        );
        res.status(201).json(
          CreateBankFinancialAccountResponse.parse(
            financialAccountResponse(account),
          ),
        );
      } catch (error) {
        if (error instanceof FinanceWorkspaceValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: "Your finance account could not be saved." });
      }
    },
  );

  router.patch(
    "/bank/personal-finance/accounts/:accountId",
    async (req, res): Promise<void> => {
      const params = UpdateBankFinancialAccountParams.safeParse(req.params);
      const parsed = UpdateBankFinancialAccountBody.safeParse(req.body);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      if (Object.keys(parsed.data).length === 0) {
        res.status(400).json({ error: "Provide at least one field to update." });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const current = await store.findAccount(owner.id, params.data.accountId);
        if (!current) {
          res.status(404).json({ error: "Finance account not found." });
          return;
        }
        const updated = await store.updateAccount(
          owner.id,
          params.data.accountId,
          mergeFinancialAccountUpdate(current, parsed.data),
        );
        if (!updated) {
          res.status(404).json({ error: "Finance account not found." });
          return;
        }
        res.json(
          UpdateBankFinancialAccountResponse.parse(
            financialAccountResponse(updated),
          ),
        );
      } catch (error) {
        if (error instanceof FinanceWorkspaceValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: "Your finance account could not be updated." });
      }
    },
  );

  router.get(
    "/bank/personal-finance/loan-applications",
    async (req, res): Promise<void> => {
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        res.json(
          ListBankFinanceLoanApplicationsResponse.parse(
            (await store.listLoanApplications(owner.id)).map(
              financeLoanApplicationResponse,
            ),
          ),
        );
      } catch {
        res
          .status(500)
          .json({ error: "Your application requests could not be loaded." });
      }
    },
  );

  router.post(
    "/bank/personal-finance/loan-applications",
    async (req, res): Promise<void> => {
      const parsed = CreateBankFinanceLoanApplicationBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const application = await store.createLoanApplication(
          owner.id,
          normalizeFinanceLoanApplication(parsed.data),
        );
        res.status(201).json(
          CreateBankFinanceLoanApplicationResponse.parse(
            financeLoanApplicationResponse(application),
          ),
        );
      } catch (error) {
        if (error instanceof FinanceWorkspaceValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res
          .status(500)
          .json({ error: "Your application request could not be submitted." });
      }
    },
  );

  router.patch(
    "/bank/personal-finance/loan-applications/:applicationId",
    async (req, res): Promise<void> => {
      const params = WithdrawBankFinanceLoanApplicationParams.safeParse(req.params);
      const parsed = WithdrawBankFinanceLoanApplicationBody.safeParse(req.body);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const application = await store.withdrawLoanApplication(
          owner.id,
          params.data.applicationId,
        );
        const result =
          application ??
          (await store.findLoanApplication(
            owner.id,
            params.data.applicationId,
          ));
        if (!result) {
          res.status(404).json({ error: "Application request not found." });
          return;
        }
        res.json(
          WithdrawBankFinanceLoanApplicationResponse.parse(
            financeLoanApplicationResponse(result),
          ),
        );
      } catch {
        res
          .status(500)
          .json({ error: "Your application request could not be withdrawn." });
      }
    },
  );

  return router;
}

export default createBankFinanceWorkspaceRouter();
