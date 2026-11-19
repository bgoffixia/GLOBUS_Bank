ALTER TABLE "bank_users" ADD COLUMN "profile_setup_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_users" ADD COLUMN "testing_mode_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_users" ADD COLUMN "transfer_access_granted" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "bank_account_tiers" SET "name" = 'Standard 🏦', "updated_at" = now() WHERE "id" = 'standard';
--> statement-breakpoint
UPDATE "bank_account_tiers" SET "name" = 'Silver🥈', "updated_at" = now() WHERE "id" = 'vault-monthly';
--> statement-breakpoint
UPDATE "bank_account_tiers" SET "name" = 'Gold 🪙', "updated_at" = now() WHERE "id" = 'vault-quarterly';
--> statement-breakpoint
UPDATE "bank_account_tiers" SET "name" = 'Bronze 🥉', "updated_at" = now() WHERE "id" = 'vault-annual';
--> statement-breakpoint
UPDATE "bank_users"
SET "profile_setup_completed_at" = COALESCE("updated_at", "created_at", now())
WHERE NULLIF(btrim("first_name"), '') IS NOT NULL
  AND NULLIF(btrim("last_name"), '') IS NOT NULL;