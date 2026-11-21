import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateBankPersonalFinanceRecordBody,
  CreateBankPersonalFinanceRecordResponse,
  DeleteBankPersonalFinanceRecordParams,
  DeleteBankPersonalFinanceRecordResponse,
  GetBankPersonalFinanceOverviewQueryParams,
  GetBankPersonalFinanceOverviewResponse,
  ListBankPersonalFinanceRecordsQueryParams,
  ListBankPersonalFinanceRecordsResponse,
  UpdateBankPersonalFinanceRecordBody,
  UpdateBankPersonalFinanceRecordParams,
  UpdateBankPersonalFinanceRecordResponse,
} from "@workspace/api-zod";
import type { BankPersonalFinanceRecord } from "@workspace/db";
import { ensureBankUser } from "../lib/bank";
import {
  mergePersonalFinanceRecordUpdate,
  normalizePersonalFinanceRecord,
  personalFinanceRecordResponse,
  PersonalFinanceValidationError,
} from "../lib/personal-finance";
import {
  drizzlePersonalFinanceStore,
  type PersonalFinanceStore,
} from "../lib/personal-finance-store";

type RouterDependencies = {
  store?: PersonalFinanceStore;
  resolveOwner?: (clerkUserId: string) => Promise<{ id: string }>;
};

async function resolveAuthenticatedOwner(
  req: Request,
  res: Response,
  resolver: NonNullable<RouterDependencies["resolveOwner"]>,
) {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to manage your finance records." });
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

export function createBankPersonalFinanceRouter({
  store = drizzlePersonalFinanceStore,
  resolveOwner = async (clerkUserId) => {
    const user = await ensureBankUser(clerkUserId);
    return { id: user.id };
  },
}: RouterDependencies = {}) {
  const router = Router();

  router.get("/bank/personal-finance/records", async (req, res): Promise<void> => {
    const query = ListBankPersonalFinanceRecordsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
    if (!owner) return;

    try {
      const result = await store.list(owner.id, query.data);
      const response = ListBankPersonalFinanceRecordsResponse.parse({
        records: result.records.map(personalFinanceRecordResponse),
        total: result.total,
        page: query.data.page,
        pageSize: query.data.pageSize,
      });
      res.json(response);
    } catch {
      res.status(500).json({ error: "Your finance records could not be loaded." });
    }
  });

  router.post("/bank/personal-finance/records", async (req, res): Promise<void> => {
    const parsed = CreateBankPersonalFinanceRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
    if (!owner) return;

    try {
      const normalized = normalizePersonalFinanceRecord(parsed.data);
      const record = await store.create(owner.id, normalized);
      res.status(201).json(
        CreateBankPersonalFinanceRecordResponse.parse(
          personalFinanceRecordResponse(record),
        ),
      );
    } catch (error) {
      if (error instanceof PersonalFinanceValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Your finance record could not be saved." });
    }
  });

  router.patch(
    "/bank/personal-finance/records/:recordId",
    async (req, res): Promise<void> => {
      const params = UpdateBankPersonalFinanceRecordParams.safeParse(req.params);
      const parsed = UpdateBankPersonalFinanceRecordBody.safeParse(req.body);
      if (!params.success) {
        res.status(400).json({
          error: params.error.message,
        });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.message,
        });
        return;
      }
      if (Object.keys(parsed.data).length === 0) {
        res.status(400).json({ error: "Provide at least one field to update." });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const current = await store.find(owner.id, params.data.recordId);
        if (!current) {
          res.status(404).json({ error: "Finance record not found." });
          return;
        }
        const normalized = mergePersonalFinanceRecordUpdate(
          current as BankPersonalFinanceRecord,
          parsed.data,
        );
        const updated = await store.update(
          owner.id,
          params.data.recordId,
          normalized,
        );
        if (!updated) {
          res.status(404).json({ error: "Finance record not found." });
          return;
        }
        res.json(
          UpdateBankPersonalFinanceRecordResponse.parse(
            personalFinanceRecordResponse(updated),
          ),
        );
      } catch (error) {
        if (error instanceof PersonalFinanceValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: "Your finance record could not be updated." });
      }
    },
  );

  router.delete(
    "/bank/personal-finance/records/:recordId",
    async (req, res): Promise<void> => {
      const params = DeleteBankPersonalFinanceRecordParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const deleted = await store.delete(owner.id, params.data.recordId);
        if (!deleted) {
          res.status(404).json({ error: "Finance record not found." });
          return;
        }
        res.json(DeleteBankPersonalFinanceRecordResponse.parse({ deleted: true }));
      } catch {
        res.status(500).json({ error: "Your finance record could not be deleted." });
      }
    },
  );

  router.get(
    "/bank/personal-finance/overview",
    async (req, res): Promise<void> => {
      const query = GetBankPersonalFinanceOverviewQueryParams.safeParse(req.query);
      if (!query.success) {
        res.status(400).json({ error: query.error.message });
        return;
      }
      const owner = await resolveAuthenticatedOwner(req, res, resolveOwner);
      if (!owner) return;

      try {
        const overview = await store.overview(owner.id, query.data.period);
        res.json(GetBankPersonalFinanceOverviewResponse.parse({
          ...overview,
          recentExpenses: overview.recentExpenses.map(personalFinanceRecordResponse),
        }));
      } catch {
        res.status(500).json({ error: "Your financial overview could not be loaded." });
      }
    },
  );

  return router;
}

export default createBankPersonalFinanceRouter();
