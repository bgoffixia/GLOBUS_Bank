CREATE TABLE "bank_vault_admin_entitlements" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_vault_admin_entitlements" ADD CONSTRAINT "bank_vault_admin_entitlements_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_vault_admin_entitlements" ADD CONSTRAINT "bank_vault_admin_entitlements_granted_by_user_id_bank_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_vault_admin_entitlement_grantor_idx" ON "bank_vault_admin_entitlements" USING btree ("granted_by_user_id","granted_at");