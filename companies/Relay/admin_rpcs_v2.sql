-- Additional Admin RPCs for Business Owner Dashboard

-- 1. Get Growth Data (Last 30 Days)
CREATE OR REPLACE FUNCTION admin_get_growth_data()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM admin_check_auth();
  
  WITH dates AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date
  ),
  user_counts AS (
    SELECT date(created_at) as date, count(*) as count
    FROM auth.users
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date(created_at)
  ),
  campaign_counts AS (
    SELECT date(created_at) as date, count(*) as count
    FROM public.campaigns
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date(created_at)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.date, 'Mon DD'),
      'users', COALESCE(u.count, 0),
      'campaigns', COALESCE(c.count, 0)
    ) ORDER BY d.date ASC
  ) INTO result
  FROM dates d
  LEFT JOIN user_counts u ON d.date = u.date
  LEFT JOIN campaign_counts c ON d.date = c.date;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get Recent Activity
CREATE OR REPLACE FUNCTION admin_get_recent_activity()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM admin_check_auth();
  
  WITH recent_users AS (
    SELECT 
      id,
      email::text as name,
      'user_joined' as type,
      created_at
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 10
  ),
  recent_campaigns AS (
    SELECT 
      id,
      name,
      'campaign_created' as type,
      created_at
    FROM public.campaigns
    ORDER BY created_at DESC
    LIMIT 10
  ),
  combined AS (
    SELECT * FROM recent_users
    UNION ALL
    SELECT * FROM recent_campaigns
    ORDER BY created_at DESC
    LIMIT 15
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'type', type,
      'created_at', created_at
    )
  ) INTO result
  FROM combined;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
