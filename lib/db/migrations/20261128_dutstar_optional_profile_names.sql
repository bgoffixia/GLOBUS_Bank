CREATE OR REPLACE FUNCTION public.ensure_dutstar_customer_profile(
  p_clerk_user_id text,
  p_verified_email text,
  p_first_name text,
  p_last_name text,
  p_accepted_terms boolean DEFAULT false
)
RETURNS TABLE(
  id text,
  email text,
  customer_id text,
  first_name text,
  last_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(p_verified_email));
  v_first_name text := nullif(btrim(p_first_name), '');
  v_last_name text := nullif(btrim(p_last_name), '');
BEGIN
  IF p_clerk_user_id IS NULL OR length(btrim(p_clerk_user_id)) = 0
     OR v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid_customer_profile_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bank_users (
    id, email, customer_id, first_name, last_name, accepted_terms_at
  )
  VALUES (
    p_clerk_user_id,
    v_email,
    'DUT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_first_name,
    v_last_name,
    CASE WHEN p_accepted_terms THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.bank_users u
    WHERE u.id = p_clerk_user_id AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'customer_identity_email_conflict' USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.customer_id, u.first_name, u.last_name, u.created_at
  FROM public.bank_users u
  WHERE u.id = p_clerk_user_id;
END;
$function$;
