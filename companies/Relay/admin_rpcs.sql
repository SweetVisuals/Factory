-- Admin RPCs for Relay Dashboard
-- These bypass RLS via SECURITY DEFINER but enforce strict email checking.

CREATE OR REPLACE FUNCTION admin_check_auth() RETURNS void AS $$
BEGIN
  IF auth.jwt() ->> 'email' != 'admin@relaysolutions.net' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. Get Global Stats
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS JSONB AS $$
DECLARE
  total_users INT;
  live_users INT;
  total_campaigns INT;
  total_emails INT;
BEGIN
  PERFORM admin_check_auth();
  
  SELECT count(*) INTO total_users FROM auth.users;
  SELECT count(*) INTO live_users FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '1 hour';
  SELECT count(*) INTO total_campaigns FROM public.campaigns;
  SELECT count(*) INTO total_emails FROM public.email_accounts;

  RETURN jsonb_build_object(
    'total_users', total_users,
    'live_users', live_users,
    'total_campaigns', total_campaigns,
    'total_emails', total_emails
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get All Users List
CREATE OR REPLACE FUNCTION admin_get_users_list()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  provider TEXT,
  campaign_count BIGINT,
  email_account_count BIGINT
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
    (SELECT count(*) FROM public.email_accounts e WHERE e.user_id = u.id) as email_account_count
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get User Campaigns
CREATE OR REPLACE FUNCTION admin_get_user_campaigns(target_uid UUID)
RETURNS SETOF public.campaigns AS $$
BEGIN
  PERFORM admin_check_auth();
  RETURN QUERY SELECT * FROM public.campaigns WHERE user_id = target_uid ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get User Emails
CREATE OR REPLACE FUNCTION admin_get_user_emails(target_uid UUID)
RETURNS SETOF public.email_accounts AS $$
BEGIN
  PERFORM admin_check_auth();
  RETURN QUERY SELECT * FROM public.email_accounts WHERE user_id = target_uid ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Force Change Password
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION admin_force_change_password(target_uid UUID, new_pass TEXT)
RETURNS void AS $$
BEGIN
  PERFORM admin_check_auth();
  UPDATE auth.users 
  SET encrypted_password = crypt(new_pass, gen_salt('bf'))
  WHERE id = target_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Force Pause Campaign
CREATE OR REPLACE FUNCTION admin_force_pause_campaign(camp_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM admin_check_auth();
  UPDATE public.campaigns SET status = 'paused' WHERE id = camp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Force Delete Campaign
CREATE OR REPLACE FUNCTION admin_force_delete_campaign(camp_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM admin_check_auth();
  DELETE FROM public.campaigns WHERE id = camp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Force Delete Email
CREATE OR REPLACE FUNCTION admin_force_delete_email(target_email_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM admin_check_auth();
  DELETE FROM public.email_accounts WHERE id = target_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
