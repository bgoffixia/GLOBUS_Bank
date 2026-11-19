CREATE TABLE "bank_account_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"vault_plan_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_account_tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "bank_account_tiers" ("id", "name", "description", "vault_plan_code")
VALUES
	('standard', 'Standard', 'Default customer account tier.', NULL),
	('vault-monthly', 'Vault Monthly', 'Effective tier while the one-month Vault plan is active.', '1m'),
	('vault-quarterly', 'Vault 3-Month', 'Effective tier while the three-month Vault plan is active.', '3m'),
	('vault-annual', 'Vault Annual', 'Effective tier while the annual Vault plan is active.', '1y');
--> statement-breakpoint
ALTER TABLE "bank_users" ADD COLUMN "account_tier_id" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_account_tiers_vault_plan_unique" ON "bank_account_tiers" USING btree ("vault_plan_code");--> statement-breakpoint
ALTER TABLE "bank_users" ADD CONSTRAINT "bank_users_account_tier_id_bank_account_tiers_id_fk" FOREIGN KEY ("account_tier_id") REFERENCES "public"."bank_account_tiers"("id") ON DELETE no action ON UPDATE no action;