export interface Business { 
  id: string; 
  name: string; 
  slug: string; 
  overview_md: string | null; 
  aims_md?: string | null; 
  objectives_md?: string | null; 
  status: string; 
  signature_template?: string; 
  industry?: string;
  target_audience?: string;
}

export interface EmailTone {
  id: string;
  name: string;
  slug: string;
  content_md: string;
  is_active: boolean;
  category?: string;
}

export interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'Active' | 'Paused' | 'Draft' | 'scheduled' | 'in_progress';
  prospects: string;
  replies: string;
  openRate: string;
  replyRate: string;
  niche?: string;
  emailTemplate?: string;
  schedule?: {
    frequency: 'daily' | 'weekly';
    maxEmailsPerDay: number;
  };
  company_name?: string;
  contact_number?: string;
  primary_email?: string;
  pitch?: string;
  objective?: string;
  business_id?: string;
  target_id?: string;
  current_step?: number;
  sent?: string;
}

export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  name: string;
  imap_host: string;
  imap_port: string;
  smtp_host: string;
  smtp_port: string;
  created_at: string;
  warmup_enabled: boolean;
  warmup_filter_tag: string | null;
  warmup_increase_per_day: number;
  warmup_daily_limit: number;
  warmup_status: 'enabled' | 'paused' | 'disabled';
  emailsSent?: number;
  warmupEmails?: number;
  healthScore?: string;
  warmup_start_date: string | null;
  status?: string;
  error_message?: string;
  warmupEmailsReceived?: number;
  warmupEmailsSent?: number;
  spamSaved?: number;
  warmupStats?: {
    received: Record<string, number>;
    sent: Record<string, number>;
  };
  signature?: string;
  signatures?: Array<{
    id: string;
    name: string;
    content: string;
    imageUrl?: string | null;
    isDefault?: boolean;
  }>;
  daily_limit?: number;
  smtp_password: string;
  password: string;
  encrypted_password?: string;
  company?: string;
  phone_number?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
}

export interface CampaignStat {
  label: string;
  value: string;
  percentage?: string;
  separator?: boolean;
  money?: string;
}

export interface KeyPerson {
  name: string;
  title: string;
  linkedin?: string;
}

export interface PainPoint {
  area: string;
  description: string;
  severity?: 'high' | 'medium' | 'low';
}

export interface NewsItem {
  headline: string;
  date?: string;
  source?: string;
}

export interface GrowthSignal {
  type: string;
  detail: string;
  date?: string;
}

export interface SocialPresence {
  google_rating?: number;
  review_count?: number;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
}

export interface Lead {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  role?: string;
  phone?: string;
  linkedin?: string;
  industry?: string;
  location?: string;
  employees?: string;
  company_news?: string;
  website?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  source?: string;
  status?: string;
  summary?: string;
  personalized_email?: string;
  validation_status?: 'valid' | 'invalid' | 'catch_all' | 'unverified' | undefined;
  validation_details?: string;
  research_status?: 'completed' | 'pending' | 'failed' | 'incomplete' | 'error' | null;
  // Deep research structured fields
  company_description?: string;
  company_size?: string;
  annual_revenue?: string;
  year_founded?: string;
  key_people?: KeyPerson[];
  tech_stack?: string[];
  pain_points?: PainPoint[];
  recent_news?: NewsItem[];
  social_presence?: SocialPresence;
  services_offered?: string[];
  target_market?: string;
  competitive_advantage?: string;
  growth_signals?: GrowthSignal[];
  research_data_raw?: string;
  research_score?: number;
  researched_at?: string;
  review_count?: number;
  bad_reviews?: {source: string, text: string}[];
}

export interface EmailMessage {
  id: string;
  uid: number;
  accountId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  folder: 'inbox' | 'sent' | 'archive';
  isRead: boolean;
  text?: string;
  html?: string;
}
