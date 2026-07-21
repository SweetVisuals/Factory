/**
 * Rate Limiter & Abuse Prevention Module
 * 
 * Centralised rate limiting for:
 * - Email sending (per account, per campaign, global daily)
 * - AI API calls (daily call count, token budget, cost tracking)
 * - Circuit breaker (stops sending if bounce rate too high)
 * 
 * All limits are configurable via the `rate_limits` DB table.
 * All usage is tracked in `email_send_limits` and `ai_usage_log` tables.
 * 
 * @module rate_limiter
 */

// ─── Default Limits (used if DB row missing) ────────────────────────────────
const DEFAULTS = {
  daily_email_total: 200,
  daily_ai_calls: 50,
  ai_budget_usd_cents: 500,       // $5.00
  max_bounce_rate_pct: 15,
  emails_per_account_per_hour: 30,
  emails_per_campaign_per_run: 50,
};

// ─── In-Memory Counters (reset per run) ─────────────────────────────────────
let _runEmailCount = 0;
let _runAiCallCount = 0;
let _campaignEmailCounts = new Map(); // campaign_id -> count this run
let _accountHourlyCounts = new Map(); // account_id -> count this hour
let _limits = null; // cached DB limits
let _limitsLoadedAt = 0;

/**
 * Load rate limits from the DB. Caches for 5 minutes.
 */
async function loadLimits(supabase) {
  const now = Date.now();
  if (_limits && (now - _limitsLoadedAt) < 300_000) return _limits;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('rate_limits')
    .select('limit_key, limit_value, current_value, reset_date');

  if (error || !data) {
    console.warn('[RateLimiter] Failed to load limits from DB, using defaults:', error?.message);
    _limits = { ...DEFAULTS };
    _limitsLoadedAt = now;
    return _limits;
  }

  const result = { ...DEFAULTS };
  for (const row of data) {
    // Auto-reset if the date rolled over
    if (row.reset_date !== today) {
      await supabase.from('rate_limits')
        .update({ current_value: 0, reset_date: today, updated_at: new Date().toISOString() })
        .eq('limit_key', row.limit_key);
      row.current_value = 0;
    }
    result[row.limit_key] = row.limit_value;
    result[`_current_${row.limit_key}`] = row.current_value;
  }

  _limits = result;
  _limitsLoadedAt = now;
  return result;
}

/**
 * Reset per-run counters. Call at the start of each processing cycle.
 */
export function resetRunCounters() {
  _runEmailCount = 0;
  _runAiCallCount = 0;
  _campaignEmailCounts = new Map();
  _accountHourlyCounts = new Map();
}

// ─── EMAIL RATE LIMITING ────────────────────────────────────────────────────

/**
 * Check if we can send another email. Returns { allowed, reason }.
 * 
 * Checks:
 * 1. Global daily email cap
 * 2. Per-account daily cap (from email_accounts.daily_limit)
 * 3. Per-account hourly cap (from rate_limits)
 * 4. Per-campaign-per-run cap
 * 5. Circuit breaker (bounce rate)
 */
export async function canSendEmail(supabase, { accountId, accountEmail, campaignId, accountDailyLimit }) {
  const limits = await loadLimits(supabase);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Global daily cap
  const globalCurrentDay = (limits._current_daily_email_total || 0) + _runEmailCount;
  if (globalCurrentDay >= limits.daily_email_total) {
    return { allowed: false, reason: `Global daily email limit reached (${limits.daily_email_total}). Resets tomorrow.` };
  }

  // 2. Per-account daily cap
  const { data: accountUsage } = await supabase
    .from('email_send_limits')
    .select('emails_sent, bounces, failures')
    .eq('email_account_id', accountId)
    .eq('send_date', today)
    .maybeSingle();

  const accountSentToday = accountUsage?.emails_sent || 0;
  const effectiveDailyLimit = Math.min(accountDailyLimit || 100, 200); // Hard max 200/account/day
  if (accountSentToday >= effectiveDailyLimit) {
    return { allowed: false, reason: `Account ${accountEmail} daily limit reached (${effectiveDailyLimit}). Sent: ${accountSentToday}.` };
  }

  // 3. Per-account hourly cap
  const hourlyKey = `${accountId}_${new Date().getHours()}`;
  const accountHourly = _accountHourlyCounts.get(hourlyKey) || 0;
  if (accountHourly >= limits.emails_per_account_per_hour) {
    return { allowed: false, reason: `Account ${accountEmail} hourly limit reached (${limits.emails_per_account_per_hour}). Wait for next hour.` };
  }

  // 4. Per-campaign-per-run cap
  const campaignRunCount = _campaignEmailCounts.get(campaignId) || 0;
  if (campaignRunCount >= limits.emails_per_campaign_per_run) {
    return { allowed: false, reason: `Campaign run limit reached (${limits.emails_per_campaign_per_run}). Will continue next cycle.` };
  }

  // 5. Circuit breaker — check bounce rate for this account
  if (accountUsage) {
    const totalAttempts = accountUsage.emails_sent + accountUsage.bounces + accountUsage.failures;
    if (totalAttempts >= 10) { // Only check after 10+ attempts
      const bounceRate = (accountUsage.bounces / totalAttempts) * 100;
      if (bounceRate >= limits.max_bounce_rate_pct) {
        return { allowed: false, reason: `CIRCUIT BREAKER: Account ${accountEmail} bounce rate ${bounceRate.toFixed(1)}% exceeds limit (${limits.max_bounce_rate_pct}%). Sending halted.` };
      }
    }
  }

  return { allowed: true, reason: 'OK' };
}

/**
 * Record a sent email. Increments all relevant counters.
 */
export async function recordEmailSent(supabase, { accountId, campaignId }) {
  _runEmailCount++;
  const hourlyKey = `${accountId}_${new Date().getHours()}`;
  _accountHourlyCounts.set(hourlyKey, (_accountHourlyCounts.get(hourlyKey) || 0) + 1);
  _campaignEmailCounts.set(campaignId, (_campaignEmailCounts.get(campaignId) || 0) + 1);

  const today = new Date().toISOString().slice(0, 10);

  // Upsert daily counter
  await supabase.rpc('increment_email_send_count', { 
    p_account_id: accountId, 
    p_date: today,
    p_field: 'emails_sent'
  }).then(() => {}).catch(async () => {
    // Fallback: manual upsert if RPC doesn't exist
    const { data: existing } = await supabase
      .from('email_send_limits')
      .select('id, emails_sent')
      .eq('email_account_id', accountId)
      .eq('send_date', today)
      .maybeSingle();

    if (existing) {
      await supabase.from('email_send_limits')
        .update({ emails_sent: (existing.emails_sent || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('email_send_limits')
        .insert({ email_account_id: accountId, send_date: today, emails_sent: 1 });
    }
  });

  // Increment global daily counter
  await supabase.from('rate_limits')
    .update({ 
      current_value: supabase.rpc ? undefined : 0, // Will be handled by SQL
      updated_at: new Date().toISOString() 
    })
    .eq('limit_key', 'daily_email_total')
    .then(() => {}).catch(() => {});

  // Direct SQL increment is more reliable
  try {
    await supabase.rpc('execute_sql', { query: `UPDATE rate_limits SET current_value = current_value + 1, updated_at = now() WHERE limit_key = 'daily_email_total'` });
  } catch {
    // Non-critical
  }
}

/**
 * Record a bounce.
 */
export async function recordBounce(supabase, { accountId }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('email_send_limits')
    .select('id, bounces')
    .eq('email_account_id', accountId)
    .eq('send_date', today)
    .maybeSingle();

  if (existing) {
    await supabase.from('email_send_limits')
      .update({ bounces: (existing.bounces || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('email_send_limits')
      .insert({ email_account_id: accountId, send_date: today, bounces: 1 });
  }
}

// ─── AI RATE LIMITING ───────────────────────────────────────────────────────

/**
 * Check if we can make an AI API call. Returns { allowed, reason }.
 */
export async function canCallAI(supabase) {
  const limits = await loadLimits(supabase);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Daily AI call count
  const globalAiCurrent = (limits._current_daily_ai_calls || 0) + _runAiCallCount;
  if (globalAiCurrent >= limits.daily_ai_calls) {
    return { allowed: false, reason: `Daily AI call limit reached (${limits.daily_ai_calls}). AI personalization disabled for today.` };
  }

  // 2. Daily AI budget (sum from ai_usage_log)
  const { data: costData } = await supabase
    .from('ai_usage_log')
    .select('cost_usd')
    .gte('created_at', `${today}T00:00:00Z`)
    .eq('success', true);

  if (costData) {
    const totalCostCents = costData.reduce((sum, row) => sum + (parseFloat(row.cost_usd) || 0) * 100, 0);
    if (totalCostCents >= limits.ai_budget_usd_cents) {
      return { allowed: false, reason: `Daily AI budget exceeded ($${(totalCostCents / 100).toFixed(2)} of $${(limits.ai_budget_usd_cents / 100).toFixed(2)}). AI disabled.` };
    }
  }

  return { allowed: true, reason: 'OK' };
}

/**
 * Record an AI API call. Logs usage to ai_usage_log.
 */
export async function recordAICall(supabase, { 
  provider, model, tokensPrompt = 0, tokensCompletion = 0, 
  costUsd = 0, campaignId = null, leadId = null, success = true, errorMessage = null 
}) {
  _runAiCallCount++;

  await supabase.from('ai_usage_log').insert({
    provider,
    model,
    tokens_prompt: tokensPrompt,
    tokens_completion: tokensCompletion,
    tokens_total: tokensPrompt + tokensCompletion,
    cost_usd: costUsd,
    campaign_id: campaignId,
    lead_id: leadId,
    success,
    error_message: errorMessage,
  });

  // Increment daily AI call counter
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await supabase.from('rate_limits')
      .select('current_value, reset_date')
      .eq('limit_key', 'daily_ai_calls')
      .maybeSingle();
    
    if (row) {
      const newVal = row.reset_date === today ? (row.current_value || 0) + 1 : 1;
      await supabase.from('rate_limits')
        .update({ current_value: newVal, reset_date: today, updated_at: new Date().toISOString() })
        .eq('limit_key', 'daily_ai_calls');
    }
  } catch { /* non-critical */ }
}

// ─── USAGE REPORTING ────────────────────────────────────────────────────────

/**
 * Get a summary of today's usage for display/logging.
 */
export async function getUsageSummary(supabase) {
  const today = new Date().toISOString().slice(0, 10);
  const limits = await loadLimits(supabase);

  // Email usage per account
  const { data: emailUsage } = await supabase
    .from('email_send_limits')
    .select('*, email_accounts!inner(email, name)')
    .eq('send_date', today);

  // AI usage
  const { data: aiUsage } = await supabase
    .from('ai_usage_log')
    .select('provider, tokens_total, cost_usd, success')
    .gte('created_at', `${today}T00:00:00Z`);

  const totalEmails = emailUsage?.reduce((s, r) => s + (r.emails_sent || 0), 0) || 0;
  const totalBounces = emailUsage?.reduce((s, r) => s + (r.bounces || 0), 0) || 0;
  const totalAiCalls = aiUsage?.length || 0;
  const totalAiCost = aiUsage?.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0) || 0;
  const totalTokens = aiUsage?.reduce((s, r) => s + (r.tokens_total || 0), 0) || 0;

  return {
    date: today,
    emails: {
      sent: totalEmails,
      limit: limits.daily_email_total,
      bounces: totalBounces,
      bounceRate: totalEmails > 0 ? ((totalBounces / totalEmails) * 100).toFixed(1) + '%' : '0%',
      perAccount: emailUsage?.map(r => ({
        account: r.email_accounts?.email,
        sent: r.emails_sent,
        bounces: r.bounces,
        failures: r.failures,
      })) || [],
    },
    ai: {
      calls: totalAiCalls,
      limit: limits.daily_ai_calls,
      tokens: totalTokens,
      cost: `$${totalAiCost.toFixed(4)}`,
      budgetLimit: `$${(limits.ai_budget_usd_cents / 100).toFixed(2)}`,
    },
    thisRun: {
      emails: _runEmailCount,
      aiCalls: _runAiCallCount,
    },
  };
}
