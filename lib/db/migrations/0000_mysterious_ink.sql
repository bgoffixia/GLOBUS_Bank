CREATE TYPE "public"."bank_currency_code" AS ENUM('USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD');--> statement-breakpoint
CREATE TYPE "public"."bank_request_type" AS ENUM('deposit', 'withdrawal', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."bank_restriction_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."bank_restriction_type" AS ENUM('suspend_user', 'restrict_outgoing_transfers', 'restrict_withdrawals', 'restrict_deposits', 'freeze_wallet', 'under_review', 'read_only');--> statement-breakpoint
CREATE TYPE "public"."bank_transaction_status" AS ENUM('completed', 'pending', 'failed', 'rejected', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."bank_transaction_type" AS ENUM('simulation_credit', 'admin_funding', 'admin_adjustment', 'reversal', 'external_transfer', 'external_transfer_in', 'sandbox_credit', 'transfer', 'deposit_request', 'withdrawal_request', 'exchange_request');--> statement-breakpoint
CREATE TABLE "bank_admin_settings" (
	"id" text PRIMARY KEY DEFAULT 'operations' NOT NULL,
	"customer_email_sender_domain" text DEFAULT 'globus.website' NOT NULL,
	"customer_email_sender_display_name" text DEFAULT 'GLOBUS BANK' NOT NULL,
	"funding_limit" text DEFAULT '100000000' NOT NULL,
	"second_approval_threshold" text DEFAULT '100000000' NOT NULL,
	"unverified_dashboard_message" text DEFAULT 'Your identity verification is not complete. Submit a request for review to access eligible account features.' NOT NULL,
	"frozen_incoming_policy" text DEFAULT 'allow_frozen' NOT NULL,
	"vault_payment_method" text DEFAULT 'Manual bank transfer' NOT NULL,
	"vault_payment_bank_name" text DEFAULT '' NOT NULL,
	"vault_payment_account_name" text DEFAULT '' NOT NULL,
	"vault_payment_account_number" text DEFAULT '' NOT NULL,
	"vault_payment_instructions" text DEFAULT '' NOT NULL,
	"vault_plan_1m_price_minor" text DEFAULT '1200000' NOT NULL,
	"vault_plan_3m_price_minor" text DEFAULT '2200000' NOT NULL,
	"vault_plan_1y_price_minor" text DEFAULT '7900000' NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"wallet_id" uuid,
	"account_code" text NOT NULL,
	"currency" "bank_currency_code" NOT NULL,
	"side" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"reference" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint_hash" text NOT NULL,
	"subscription_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_push_subscriptions_endpoint_hash_unique" UNIQUE("endpoint_hash")
);
--> statement-breakpoint
CREATE TABLE "bank_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" uuid,
	"restriction_type" "bank_restriction_type" NOT NULL,
	"status" "bank_restriction_status" DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"internal_notes" text,
	"created_by_user_id" text NOT NULL,
	"removed_by_user_id" text,
	"removed_at" timestamp with time zone,
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_sandbox_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"type" "bank_request_type" NOT NULL,
	"currency" "bank_currency_code" NOT NULL,
	"destination_currency" "bank_currency_code",
	"saved_payment_method_id" uuid,
	"payment_method" text,
	"payment_method_summary" text,
	"amount_minor" bigint NOT NULL,
	"status" text DEFAULT 'pending_provider_setup' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_sandbox_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bank_sandbox_requests_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "bank_saved_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"method" text NOT NULL,
	"card_brand" text,
	"bank_name" text,
	"account_holder" text,
	"account_number_encrypted" text,
	"country" text,
	"last_four" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"initiated_by_user_id" text NOT NULL,
	"from_user_id" text,
	"to_user_id" text,
	"from_wallet_id" uuid,
	"to_wallet_id" uuid,
	"type" "bank_transaction_type" NOT NULL,
	"status" "bank_transaction_status" NOT NULL,
	"currency" "bank_currency_code" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	"counterparty" text,
	"description" text DEFAULT '' NOT NULL,
	"admin_reference" text,
	"admin_notes" text,
	"correction_of_transaction_id" uuid,
	"reversal_of_transaction_id" uuid,
	"correction_reason" text,
	"mode" text DEFAULT 'simulation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_transactions_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bank_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "bank_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"customer_id" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"country" text,
	"date_of_birth" date,
	"transaction_pin_hash" text,
	"transaction_pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"transaction_pin_locked_until" timestamp with time zone,
	"vault_passcode_hash" text,
	"vault_passcode_failed_attempts" integer DEFAULT 0 NOT NULL,
	"vault_passcode_locked_until" timestamp with time zone,
	"vault_subscription_status" text DEFAULT 'inactive' NOT NULL,
	"vault_subscription_requested_at" timestamp with time zone,
	"vault_subscription_reviewed_at" timestamp with time zone,
	"vault_subscription_reviewed_by_user_id" text,
	"vault_subscription_reason" text,
	"vault_subscription_expires_at" timestamp with time zone,
	"vault_subscription_expiry_reminder_sent_for" timestamp with time zone,
	"vault_subscription_expiry_reminder_claimed_at" timestamp with time zone,
	"vault_subscription_plan" text,
	"vault_subscription_amount_minor" text,
	"vault_subscription_payment_reference" text,
	"vault_subscription_payment_status" text DEFAULT 'none' NOT NULL,
	"vault_subscription_payment_initialized_at" timestamp with time zone,
	"vault_subscription_payment_verified_at" timestamp with time zone,
	"vault_subscription_auto_renew" boolean DEFAULT false NOT NULL,
	"vault_paystack_plan_code" text,
	"vault_paystack_subscription_code" text,
	"vault_paystack_customer_code" text,
	"vault_subscription_proof_object_path" text,
	"vault_subscription_proof_content_type" text,
	"vault_subscription_proof_size_bytes" integer,
	"vault_subscription_proof_file_name" text,
	"vault_subscription_proof_uploaded_at" timestamp with time zone,
	"vault_email_banner_theme" text DEFAULT 'navy' NOT NULL,
	"vault_email_banner_headline" text DEFAULT 'A Globus transfer notice' NOT NULL,
	"vault_email_banner_background_color" text DEFAULT '#12385d' NOT NULL,
	"vault_email_include_support_link" boolean DEFAULT false NOT NULL,
	"vault_email_support_url" text,
	"vault_email_support_label" text DEFAULT 'Contact support' NOT NULL,
	"vault_email_sender_local_part" text,
	"vault_email_alerts_enabled" boolean DEFAULT false NOT NULL,
	"push_transfer_alerts_enabled" boolean DEFAULT false NOT NULL,
	"push_wallet_alerts_enabled" boolean DEFAULT false NOT NULL,
	"push_security_alerts_enabled" boolean DEFAULT false NOT NULL,
	"verification_status" text DEFAULT 'not_started' NOT NULL,
	"verification_note" text,
	"account_status" text DEFAULT 'active' NOT NULL,
	"account_restriction_reason" text,
	"account_restriction_notes" text,
	"account_restricted_by_user_id" text,
	"account_restricted_at" timestamp with time zone,
	"accepted_terms_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_users_email_unique" UNIQUE("email"),
	CONSTRAINT "bank_users_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "bank_vault_paystack_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"payment_reference" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_vault_paystack_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "bank_vault_paystack_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_code" text NOT NULL,
	"amount_minor" text NOT NULL,
	"provider_plan_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_vault_paystack_plans_provider_plan_code_unique" UNIQUE("provider_plan_code")
);
--> statement-breakpoint
CREATE TABLE "bank_vault_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_vault_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "bank_vault_transaction_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"currency" "bank_currency_code" NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"transfers_enabled" boolean DEFAULT true NOT NULL,
	"deposits_enabled" boolean DEFAULT true NOT NULL,
	"withdrawals_enabled" boolean DEFAULT true NOT NULL,
	"future_transfer_mode" text DEFAULT 'failed' NOT NULL,
	"restriction_reason" text,
	"restriction_notes" text,
	"restricted_by_user_id" text,
	"restricted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_identity_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bank_exchange_rates" (
	"source_currency" "bank_currency_code" NOT NULL,
	"destination_currency" text NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_international_transfer_requests" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"transfer_type" text DEFAULT 'international_wire' NOT NULL,
	"user_id" text NOT NULL,
	"source_wallet_id" uuid NOT NULL,
	"source_currency" "bank_currency_code" NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	"destination_currency" text NOT NULL,
	"destination_amount_minor" bigint NOT NULL,
	"exchange_rate" numeric(24, 10) NOT NULL,
	"rate_updated_at" timestamp with time zone NOT NULL,
	"destination_country" text NOT NULL,
	"recipient_bank" text NOT NULL,
	"routing_code" text,
	"swift_bic" text,
	"sender_name" text,
	"recipient_account_name" text NOT NULL,
	"recipient_account_last4" text NOT NULL,
	"recipient_email_encrypted" text,
	"remark" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_admin_settings" ADD CONSTRAINT "bank_admin_settings_updated_by_user_id_bank_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_audit_logs" ADD CONSTRAINT "bank_audit_logs_actor_user_id_bank_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_audit_logs" ADD CONSTRAINT "bank_audit_logs_target_user_id_bank_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_ledger_entries" ADD CONSTRAINT "bank_ledger_entries_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_ledger_entries" ADD CONSTRAINT "bank_ledger_entries_wallet_id_bank_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."bank_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_notifications" ADD CONSTRAINT "bank_notifications_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_push_subscriptions" ADD CONSTRAINT "bank_push_subscriptions_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_restrictions" ADD CONSTRAINT "bank_restrictions_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_restrictions" ADD CONSTRAINT "bank_restrictions_wallet_id_bank_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."bank_wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_restrictions" ADD CONSTRAINT "bank_restrictions_created_by_user_id_bank_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_restrictions" ADD CONSTRAINT "bank_restrictions_removed_by_user_id_bank_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_sandbox_requests" ADD CONSTRAINT "bank_sandbox_requests_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_sandbox_requests" ADD CONSTRAINT "bank_sandbox_requests_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_sandbox_requests" ADD CONSTRAINT "bank_sandbox_requests_saved_payment_method_id_bank_saved_payment_methods_id_fk" FOREIGN KEY ("saved_payment_method_id") REFERENCES "public"."bank_saved_payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_saved_payment_methods" ADD CONSTRAINT "bank_saved_payment_methods_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_initiated_by_user_id_bank_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_from_user_id_bank_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_to_user_id_bank_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_from_wallet_id_bank_wallets_id_fk" FOREIGN KEY ("from_wallet_id") REFERENCES "public"."bank_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_to_wallet_id_bank_wallets_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."bank_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_vault_paystack_events" ADD CONSTRAINT "bank_vault_paystack_events_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_vault_sessions" ADD CONSTRAINT "bank_vault_sessions_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_vault_transaction_notes" ADD CONSTRAINT "bank_vault_transaction_notes_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_vault_transaction_notes" ADD CONSTRAINT "bank_vault_transaction_notes_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_wallets" ADD CONSTRAINT "bank_wallets_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_wallets" ADD CONSTRAINT "bank_wallets_restricted_by_user_id_bank_users_id_fk" FOREIGN KEY ("restricted_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_identity_documents" ADD CONSTRAINT "bank_identity_documents_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_exchange_rates" ADD CONSTRAINT "bank_exchange_rates_updated_by_user_id_bank_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_international_transfer_requests" ADD CONSTRAINT "bank_international_transfer_requests_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_international_transfer_requests" ADD CONSTRAINT "bank_international_transfer_requests_user_id_bank_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bank_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_international_transfer_requests" ADD CONSTRAINT "bank_international_transfer_requests_source_wallet_id_bank_wallets_id_fk" FOREIGN KEY ("source_wallet_id") REFERENCES "public"."bank_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_audit_actor_idx" ON "bank_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_audit_target_idx" ON "bank_audit_logs" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_ledger_transaction_idx" ON "bank_ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "bank_ledger_wallet_idx" ON "bank_ledger_entries" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "bank_notification_user_created_idx" ON "bank_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_notification_user_unread_idx" ON "bank_notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "bank_push_subscription_user_idx" ON "bank_push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bank_restriction_user_idx" ON "bank_restrictions" USING btree ("user_id","effective_at");--> statement-breakpoint
CREATE INDEX "bank_restriction_wallet_idx" ON "bank_restrictions" USING btree ("wallet_id","effective_at");--> statement-breakpoint
CREATE INDEX "bank_restriction_status_type_idx" ON "bank_restrictions" USING btree ("status","restriction_type");--> statement-breakpoint
CREATE INDEX "bank_sandbox_request_user_idx" ON "bank_sandbox_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_saved_payment_method_user_idx" ON "bank_saved_payment_methods" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_saved_payment_method_active_idx" ON "bank_saved_payment_methods" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "bank_transaction_from_user_idx" ON "bank_transactions" USING btree ("from_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_transaction_to_user_idx" ON "bank_transactions" USING btree ("to_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_transaction_status_idx" ON "bank_transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "bank_transaction_correction_idx" ON "bank_transactions" USING btree ("correction_of_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transaction_single_reversal_idx" ON "bank_transactions" USING btree ("reversal_of_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_users_vault_email_sender_local_part_unique" ON "bank_users" USING btree ("vault_email_sender_local_part");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_users_vault_subscription_payment_reference_unique" ON "bank_users" USING btree ("vault_subscription_payment_reference");--> statement-breakpoint
CREATE INDEX "bank_vault_paystack_event_user_idx" ON "bank_vault_paystack_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_vault_paystack_term_amount_unique" ON "bank_vault_paystack_plans" USING btree ("plan_code","amount_minor");--> statement-breakpoint
CREATE INDEX "bank_vault_session_user_expiry_idx" ON "bank_vault_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_vault_transaction_note_user_tx_unique" ON "bank_vault_transaction_notes" USING btree ("user_id","transaction_id");--> statement-breakpoint
CREATE INDEX "bank_vault_transaction_note_user_updated_idx" ON "bank_vault_transaction_notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_wallet_user_currency_unique" ON "bank_wallets" USING btree ("user_id","currency");--> statement-breakpoint
CREATE INDEX "bank_wallet_user_idx" ON "bank_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_identity_document_object_path_unique" ON "bank_identity_documents" USING btree ("object_path");--> statement-breakpoint
CREATE INDEX "bank_identity_document_user_idx" ON "bank_identity_documents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_exchange_rate_pair_unique" ON "bank_exchange_rates" USING btree ("source_currency","destination_currency");--> statement-breakpoint
CREATE INDEX "bank_international_request_user_idx" ON "bank_international_transfer_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_international_request_wallet_idx" ON "bank_international_transfer_requests" USING btree ("source_wallet_id");