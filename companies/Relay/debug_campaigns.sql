SELECT 
  c.id, 
  c.name, 
  c.status, 
  c.created_at, 
  a.is_scraping_active,
  (SELECT count(*) FROM public.campaign_leads cl WHERE cl.campaign_id = c.id) as lead_count
FROM public.campaigns c
JOIN auth.users u ON u.id = c.user_id
JOIN public.account_settings a ON a.user_id = u.id
WHERE u.email = 'ptnmgmt@gmail.com';
