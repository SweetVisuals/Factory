export interface Lead {
  id?: string;
  user_id?: string;
  email: string;
  name?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedin?: string;
  industry?: string;
  location?: string;
  employees?: string;
  company_news?: string;
  created_at?: string;
  updated_at?: string;
  status?: 'new' | 'interested' | 'closed' | string;
  personalized_email?: string;
  personalized_subject?: string;
  website?: string;
  summary?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
}

export interface CampaignLead {
  campaign_id: string;
  lead_id: string;
}

export interface ListLead {
  list_id: string;
  lead_id: string;
}
