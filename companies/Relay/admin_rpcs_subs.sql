-- RPCs for Subscription and Revenue tracking

-- Update existing admin_get_users_list to include plan_type
DROP FUNCTION IF EXISTS admin_get_users_list();

CREATE OR REPLACE FUNCTION admin_get_users_list()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  provider TEXT,
  campaign_count BIGINT,
  email_account_count BIGINT,
  plan_type TEXT
) AS $$
BEGIN
  PERFORM admin_check_auth();

  RETURN QUERY
  SELECT 
    u.id, 
    u.email::VARCHAR, 
    u.created_at, 
    u.last_sign_in_at, 
    COALESCE(u.raw_app_meta_data->>'provider', 'email')::TEXT AS provider,
    (SELECT count(*) FROM public.campaigns c WHERE c.user_id = u.id) as campaign_count,
    (SELECT count(*) FROM public.email_accounts e WHERE e.user_id = u.id) as email_account_count,
    (SELECT a.plan_type FROM public.account_settings a WHERE a.user_id = u.id) as plan_type
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_get_stats to calculate MRR based on account_settings plan_type
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS JSONB AS $$
DECLARE
  total_users INT;
  live_users INT;
  total_campaigns INT;
  total_emails INT;
  pro_count INT;
  enterprise_count INT;
  starter_count INT;
  total_mrr INT;
BEGIN
  PERFORM admin_check_auth();
  
  SELECT count(*) INTO total_users FROM auth.users;
  SELECT count(*) INTO live_users FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '1 hour';
  SELECT count(*) INTO total_campaigns FROM public.campaigns;
  SELECT count(*) INTO total_emails FROM public.email_accounts;
  
  SELECT count(*) INTO pro_count FROM public.account_settings WHERE plan_type = 'pro';
  SELECT count(*) INTO enterprise_count FROM public.account_settings WHERE plan_type = 'enterprise';
  SELECT count(*) INTO starter_count FROM public.account_settings WHERE plan_type = 'starter';
  
  -- Assuming Starter = $49, Pro = $99, Enterprise = $299
  total_mrr := (COALESCE(starter_count, 0) * 49) + (COALESCE(pro_count, 0) * 99) + (COALESCE(enterprise_count, 0) * 299);

  RETURN jsonb_build_object(
    'total_users', total_users,
    'live_users', live_users,
    'total_campaigns', total_campaigns,
    'total_emails', total_emails,
    'total_mrr', total_mrr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New function to update a user's subscription plan
CREATE OR REPLACE FUNCTION admin_update_user_plan(target_uid UUID, new_plan TEXT)
RETURNS void AS $$
BEGIN
  PERFORM admin_check_auth();
  
  UPDATE public.account_settings 
  SET plan_type = new_plan, updated_at = NOW()
  WHERE user_id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
