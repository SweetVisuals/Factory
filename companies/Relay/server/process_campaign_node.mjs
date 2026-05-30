"use strict";
import { createClient as Ne } from "@supabase/supabase-js";
import De from "nodemailer";
const Te =
    process.env["DEEPSEEK_API_KEY"] || "sk-6733c8ac2b83402b8626e5e253824488",
  Pe = "https://api.deepseek.com",
  Ae =
    process.env["SUPABASE_URL"] || "https://fzcrjogrnujrfxafxbkh.supabase.co",
  Re = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || "",
  ue = [
    process.env["OPENROUTER_API_KEY"],
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
  ].filter(Boolean);
export async function runProcessCampaign() {
  let qe = null;
  try {
    const n = Ne(Ae, Re),
      { data: pe } = await n
        .from("api_keys")
        .select("key_value")
        .eq("service", "disable_deepseek")
        .maybeSingle(),
      ge = pe?.key_value === "true";
    console.log("Checking engine status...");
    const { data: _e } = await n
      .from("agent_memory")
      .select("value")
      .eq("key_name", "factory_status")
      .maybeSingle();
    if (_e?.value?.status === "paused")
      return (
        console.log("Engine is PAUSED. Standing by."),
        JSON.stringify({ message: "Engine paused" })
      );
    console.log("Checking for scheduled campaigns...");
    const { data: q, error: x } = await n
      .from("scheduled_emails")
      .select(
        `
            *,
            campaigns!scheduled_emails_campaign_id_fkey!inner (
                id, name, status, company_name, contact_number, primary_email, business_id,
                businesses!inner (
                    id, name, status, signature_template
                )
            ),
            templates!scheduled_emails_template_id_fkey!inner (*)
        `,
      )
      .eq("status", "scheduled")
      .eq("campaigns.status", "in_progress")
      .eq("campaigns.businesses.status", "active");
    if (x) throw (console.error("Database query error:", x), x);
    if (!q || q.length === 0)
      return JSON.stringify({ message: "No active schedules" });
    const L = (q || []).filter((e) => {
      const o = e.campaigns,
        m = o?.businesses;
      return !m || m.status !== "active"
        ? (console.log(
            `Skipping schedule ${e.id} because business status is not active (status: ${m?.status})`,
          ),
          !1)
        : !0;
    });
    if (L.length === 0)
      return JSON.stringify({ message: "No active schedules (all filtered or inactive)" });
    const z = [],
      $ = new Map();
    for (const e of L) {
      const o = e.campaign_id;
      ($.has(o) || $.set(o, []), $.get(o).push(e));
    }
    for (const [e, o] of $)
      o.sort(
        (m, P) =>
          new Date(m.start_date).getTime() - new Date(P.start_date).getTime(),
      );
    for (const e of L) {
      const o = new Date(),
        m = new Date(e.end_date),
        P = new Date(e.scheduled_for);
      if (o > m) continue;
      if (o < P) {
        console.log(
          `Skipping schedule ${e.id}: Not due until ${P.toISOString()}`,
        );
        continue;
      }
      const J = $.get(e.campaign_id) || [],
        v = J.findIndex((t) => t.id === e.id);
      if (v > 0) {
        const t = J[v - 1],
          { data: a, error: C } = await n
            .rpc("get_pending_campaign_leads", {
              campaign_id_param: e.campaign_id,
              schedule_id_param: t.id,
            })
            .limit(1);
        if (C) {
          console.error("Error checking dependency", C);
          continue;
        }
        if (a && a.length > 0) {
          console.log(
            `Skipping step ${v + 1} (schedule ${e.id}): Previous step is not yet complete.`,
          );
          const j = 4320 * 60 * 1e3;
          let h = new Date(t.start_date).getTime() + j;
          if (
            (h < o.getTime() + j && (h = o.getTime() + j),
            new Date(e.start_date).getTime() < h)
          ) {
            const p = new Date(h),
              N =
                new Date(e.end_date).getTime() -
                new Date(e.start_date).getTime(),
              y = new Date(h + N);
            (await n
              .from("scheduled_emails")
              .update({
                start_date: p.toISOString(),
                scheduled_for: p.toISOString(),
                end_date: y.toISOString(),
              })
              .eq("id", e.id),
              (e.start_date = p.toISOString()),
              (e.scheduled_for = p.toISOString()),
              (e.end_date = y.toISOString()),
              console.log(
                `Self-healed step ${v + 1}: pushed start date to ${p.toISOString()} to maintain gap.`,
              ));
          }
          continue;
        }
        console.log(
          `Step ${v + 1} (schedule ${e.id}): Previous step complete. Proceeding.`,
        );
      }
      const K = Math.max(5, e.interval_minutes || 15),
        { data: Y } = await n
          .from("campaign_progress")
          .select("sent_at")
          .eq("campaign_id", e.campaign_id)
          .eq("schedule_id", e.id)
          .eq("status", "sent")
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: !1 })
          .limit(1)
          .maybeSingle();
      if (Y?.sent_at) {
        const t = (o.getTime() - new Date(Y.sent_at).getTime()) / 6e4;
        if (t < K) {
          console.log(
            `Skipping schedule ${e.id}: ${Math.round(t)}min since last (need ${K}min).`,
          );
          continue;
        }
      }
      const { data: M } = await n
        .from("schedule_email_accounts")
        .select("*, email_accounts!inner(*)")
        .eq("schedule_id", e.id);
      if (!M || M.length === 0) continue;
      const u = M;
      if (u.length === 0) {
        console.log(`Schedule ${e.id}: No email accounts linked.`);
        continue;
      }
      const { data: f, error: W } = await n
        .rpc("get_pending_campaign_leads", {
          campaign_id_param: e.campaign_id,
          schedule_id_param: e.id,
        })
        .limit(u.length * 5);
      if (W) {
        console.error("Error fetching pending leads", W);
        continue;
      }
      if (!f || f.length === 0) {
        console.log(`Schedule ${e.id}: No pending leads.`);
        continue;
      }
      const H = f.map((t) => t.email).filter(Boolean);
      let A = new Set();
      if (H.length > 0) {
        const { data: t } = await n
          .from("campaign_progress")
          .select("leads!inner(email)")
          .neq("campaign_id", e.campaign_id)
          .eq("status", "sent")
          .in("leads.email", H);
        if (t)
          for (const a of t)
            a.leads?.email && A.add(a.leads.email.toLowerCase());
        A.size > 0 &&
          console.log(
            `[DEDUP] Filtering ${A.size} leads already targeted by other campaigns.`,
          );
      }
      console.log(
        `Schedule ${e.id}: Processing ${f.length} leads across ${u.length} accounts.`,
      );
      let fe = 0,
        G = 0;
      for (const t of f) {
        if (!t.email || t.email.trim() === "" || !t.email.includes("@")) {
          (console.warn(`Skipping lead ${t.id}: Invalid email "${t.email}"`),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        if (A.has(t.email.toLowerCase())) {
          (console.log(
            `[DEDUP] Skipping lead ${t.email}: Already targeted by another campaign.`,
          ),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        if (
          ["interested", "replied", "unsubscribed", "bounced"].includes(
            t.status,
          )
        ) {
          (console.log(`Skipping lead ${t.email}: Status is ${t.status}`),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status:
                    t.status === "unsubscribed" ? "unsubscribed" : "replied",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        let a = null;
        if (t.assigned_email_account_id) {
          const s = u.find(
            (i) => i.email_accounts.id === t.assigned_email_account_id,
          );
          if (s) a = s.email_accounts;
          else {
            const { data: i } = await n
              .from("email_accounts")
              .select("*")
              .eq("id", t.assigned_email_account_id)
              .single();
            i &&
              ((a = i),
              console.log(
                `Lead ${t.email} using consistently assigned account ${a.email} even if not explicitly in schedule.`,
              ));
          }
        }
        if (!a) {
          ((a = u[G % u.length].email_accounts), G++);
          try {
            await n
              .from("campaign_leads")
              .update({ assigned_email_account_id: a.id })
              .eq("campaign_id", e.campaign_id)
              .eq("lead_id", t.id);
          } catch (i) {
            console.error("Failed to save assignment", i);
          }
        }
        let C = null,
          j = null,
          h = null;
        try {
          const { data: s } = await n
            .from("inbox_emails")
            .select("subject, body_text, received_at")
            .eq("campaign_id", e.campaign_id)
            .eq("to", t.email)
            .eq("folder", "sent")
            .order("received_at", { ascending: !1 })
            .limit(1);
          if (s && s.length > 0) {
            const i = s[0];
            ((j = i.body_text), (h = i.subject));
            let R = i.subject
              .replace(/^(Re|Fwd|Fw|Aw|Reply):\s*/i, "")
              .trim()
              .replace(/[%_]/g, "\\$&");
            const { data: r } = await n
              .from("inbox_emails")
              .select("body_text, received_at")
              .eq("folder", "inbox")
              .gte("received_at", i.received_at)
              .or(`from.ilike.%${t.email}%,subject.ilike.%${R}%`)
              .order("received_at", { ascending: !0 });
            r &&
              r.length > 0 &&
              (C = r.map((c) => c.body_text).join(`
---
`));
          }
        } catch (s) {
          console.error("Error scanning inbox", s);
        }
        if (C) {
          (console.log(
            `[Campaign ${e.campaign_id}] Lead ${t.email} replied. Halting sequence.`,
          ),
            await n
              .from("leads")
              .update({ status: "interested" })
              .eq("id", t.id),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "replied",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          const { data: s } = await n
            .from("scheduled_emails")
            .select("id")
            .eq("campaign_id", e.campaign_id)
            .neq("id", e.id);
          if (s && s.length > 0)
            for (const i of s)
              await n
                .from("campaign_progress")
                .upsert(
                  {
                    campaign_id: e.campaign_id,
                    schedule_id: i.id,
                    lead_id: t.id,
                    email_account_id: a.id,
                    status: "replied",
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "campaign_id,schedule_id,lead_id" },
                );
          continue;
        }
        let p = (t.name || "").trim(),
          N = (t.company || "").trim(),
          y = p.split(" ")[0];
        const D = p.toLowerCase();
        (!p ||
          D === "the" ||
          D.startsWith("the ") ||
          D.startsWith("a ") ||
          D.startsWith("an ") ||
          (N && D === N.toLowerCase())) &&
          (y = "there");
        let S = t.personalized_email,
          E = t.personalized_subject;
        const he = v === 0,
          ye =
            e.templates.content.includes("{") ||
            e.templates.content.includes("[") ||
            e.templates.subject.includes("{") ||
            e.templates.subject.includes("[");
        if ((he || !S || !E || ye) && t.summary)
          try {
            const s = y;
            let i = e.templates.content
              .replace(/\n*\{ender\}[\s\S]*$/i, "")
              .replace(/\n*\{\{ender\}\}[\s\S]*$/i, "")
              .replace(/\n*\[Sender Name\][\s\S]*$/i, "")
              .replace(/\n*<company>[\s\S]*$/i, "")
              .trim();
            const k =
                `You are a world-class B2B sales strategist personalizing cold outreach. Your goal is to rewrite the provided email template to be highly relevant to the specific lead based on their business summary.

CRITICAL RULES:
1. DO NOT return a template with placeholders like [Name] or {{company}}. Return the FINISHED email.
2. Use the lead's first name: ` +
                s +
                `.
3. Write a unique, personalized opening sentence based on the provided Lead Notes.
4. Maintain the core offer and call to action from the Original Template.
5. Tone: Professional, helpful, concise, and slightly informal (like a colleague).
6. ABSOLUTELY DO NOT include any sign-off, closing, or signature in the body. No Best, Regards, Cheers, Thanks, Sincerely, or ANY name at the end. The system auto-appends the correct sender signature. Including one will cause a DUPLICATE and a WRONG NAME.
7. Output ONLY valid JSON: { "subject": "Customized subject line", "body": "Finished email body without any sign-off or signature" }`,
              R =
                'Original Template Subject: "' +
                e.templates.subject +
                `"
Original Template Body: "` +
                i +
                `"
Lead Name: ` +
                s +
                `
Lead Company: ` +
                (t.company || "their business") +
                `
Lead Notes: "` +
                (t.summary || "") +
                `"

Instructions: Customize the subject and body for this lead. Remove all placeholders. Ensure the transition from the personalized opening to the core message is seamless.`;
            let r;
            if (ge) {
              console.log(
                "DeepSeek is disabled. Trying OpenRouter key cycling...",
              );
              let c = !1;
              for (let d = 0; d < ue.length; d++) {
                const U = ue[d];
                try {
                  const l = await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${U}`,
                        "HTTP-Referer": "https://github.com/Openclaw-Factory",
                        "X-Title": "ColdSpark",
                      },
                      body: JSON.stringify({
                        model: "openrouter/owl-alpha",
                        messages: [
                          { role: "system", content: k },
                          { role: "user", content: R },
                        ],
                        response_format: { type: "json_object" },
                      }),
                    },
                  );
                  if (l.ok) {
                    const I = await l.json();
                    if (I && !I.error && I.choices?.[0]) {
                      ((r = {
                        status: 200,
                        ok: !0,
                        json: async () => I,
                        text: async () => JSON.stringify(I),
                      }),
                        (c = !0));
                      break;
                    } else
                      console.error(
                        `OpenRouter Key ${d + 1} API Error:`,
                        I?.error?.message || JSON.stringify(I?.error),
                      );
                  } else
                    console.error(
                      `OpenRouter Key ${d + 1} Status Error:`,
                      l.status,
                      await l.text(),
                    );
                } catch (l) {
                  console.error(
                    `OpenRouter Key ${d + 1} Network/Timeout Error:`,
                    l,
                  );
                }
              }
              c ||
                (r = {
                  status: 402,
                  ok: !1,
                  json: async () => ({ error: "All OpenRouter keys failed" }),
                  text: async () => "All OpenRouter keys failed",
                });
            } else
              r = await fetch(Pe + "/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + Te,
                },
                body: JSON.stringify({
                  model: "deepseek-chat",
                  messages: [
                    { role: "system", content: k },
                    { role: "user", content: R },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
            if (r.status === 402 || r.status === 429 || !r.ok) {
              const c = await r.text();
              if (
                (console.error(`DeepSeek API Error (status ${r.status}):`, c),
                r.status === 402 ||
                  c.toLowerCase().includes("balance") ||
                  c.toLowerCase().includes("credit") ||
                  c.toLowerCase().includes("insufficient"))
              )
                return (
                  console.log(
                    "Credit exhaustion detected! Pausing factory engine.",
                  ),
                  await n
                    .from("agent_memory")
                    .upsert(
                      {
                        key_name: "factory_status",
                        value: {
                          status: "paused",
                          reason: "insufficient_credits",
                        },
                      },
                      { onConflict: "key_name" },
                    ),
                  await n
                    .from("debug_logs")
                    .insert({
                      level: "error",
                      message:
                        "DeepSeek personalizer paused sequence engine due to insufficient AI credits",
                      context: {
                        status: r.status,
                        error: c,
                        campaign_id: e.campaign_id,
                      },
                    }),
                  JSON.stringify({ success: false, error: "Engine paused due to insufficient AI credits" })
                );
              throw new Error(
                `DeepSeek API non-ok response (${r.status}): ${c}`,
              );
            } else {
              const c = await r.json();
              if (c.choices && c.choices[0]) {
                const d = c.choices[0].message.content.trim();
                try {
                  const U = d.replace(/\`\`\`json\n|\n\`\`\`/g, "").trim(),
                    l = JSON.parse(U);
                  ((S = l.body || l.Body || d),
                    (E = l.subject || l.Subject || ""));
                } catch {
                  S = d;
                }
                await n
                  .from("leads")
                  .update({ personalized_email: S, personalized_subject: E })
                  .eq("id", t.id);
              }
            }
          } catch (s) {
            console.error("AI Personalization Failed", s);
          }
        (S || (S = e.templates.content), E || (E = e.templates.subject));
        let b = "Sender";
        a.name
          ? (b = a.name.split(" ")[0])
          : a.email &&
            ((b = a.email.split("@")[0]),
            (b = b.charAt(0).toUpperCase() + b.slice(1)));
        const Se = e.campaigns.contact_number || a.phone_number || "",
          V = e.campaigns.company_name || a.company || "",
          be = a.name || b,
          we = a.email,
          X = [
            "Best,",
            "Kind regards,",
            "Regards,",
            "Warm regards,",
            "Cheers,",
          ],
          Q = X[Math.floor(Math.random() * X.length)];
        let O = S;
        const ke =
          /\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\s*\n[\s\S]{0,200}$/i;
        ((O = O.replace(ke, "").trimEnd()),
          (O = O.replace(/\n*\s*\{\{?ender\}\}?[\s\S]*$/i, "")
            .replace(/\n*\s*\[Sender Name\][\s\S]*$/i, "")
            .trimEnd()));
        const Z = a.signature ? a.signature.trim() : "",
          Ie =
            e.campaigns?.business_id === "0269fe06-4607-4c58-9263-12a3930a1dc3",
          ee =
            e.campaigns?.business_id === "102a3bca-7b0a-4cee-bd33-fefd7b4450b4",
          _ = (e.campaigns?.name || "").toLowerCase();
        let te = !1,
          ae = !1,
          ne = !1;
        ee &&
          (_.includes("web dev") ||
          _.includes("development") ||
          _.includes("website")
            ? (te = !0)
            : _.includes("ai") ||
                _.includes("artificial intelligence") ||
                _.includes("machine learning")
              ? (ae = !0)
              : (_.includes("automation") || _.includes("workflow")) &&
                (ne = !0));
        const se = [
            "P.S. If you're not the right person for this or prefer I don't reach out again, just let me know.",
            "If you'd prefer I stop emailing you, just reply and let me know.",
            "Not interested? Just reply and I'll update my notes.",
          ],
          ve = [
            "P.S. If event medical cover isn't on your radar right now, just let me know and I won't follow up.",
            "If you'd rather not receive these updates, just drop me a quick reply.",
            "Not the right time? Just let me know and I'll update my records.",
          ],
          Ee = [
            "P.S. If updating your web presence isn't on your roadmap right now, just let me know.",
            "If you're already set with a great development team, just drop a quick reply so I don't bug you again.",
            "Not the right time to talk websites? Just let me know and I'll step back.",
          ],
          Oe = [
            "P.S. If AI isn't a priority for your operations right now, just let me know and I won't follow up.",
            "If you'd prefer not to hear more about AI integration, just reply and I'll update my notes.",
            "Not the right time for AI? Just drop me a quick reply.",
          ],
          $e = [
            "P.S. If automating your workflows isn't on the agenda right now, just let me know.",
            "If your current processes are running perfectly, just drop a quick reply so I know not to reach out again.",
            "Not focused on automation at the moment? Just let me know and I'll update my records.",
          ];
        let w = se;
        Ie
          ? (w = ve)
          : ee && (te ? (w = Ee) : ae ? (w = Oe) : ne ? (w = $e) : (w = se));
        const ie = w[Math.floor(Math.random() * w.length)];
        let F;
        if (Z)
          F = `${O}

${Z}

${ie}`;
        else {
          const s = a.name || b;
          F = `${O}

${Q}
${s}
${V}

${ie}`.trimEnd();
        }
        const Ce = [
            {
              pattern:
                /{{first_name}}|{first_name}|{firstName}|\[First Name\]/gi,
              val: y,
            },
            { pattern: /{{name}}|{name}|\[Name\]/gi, val: t.name || y },
            {
              pattern: /{{company}}|{company}|{companyName}|\[Company\]/gi,
              val: N || "your business",
            },
            {
              pattern: /{{industry}}|{industry}/gi,
              val: t.industry || "industry",
            },
            { pattern: /{{location}}|{location}/gi, val: t.location || "" },
            {
              pattern: /{{sender_name}}|{sender_name}|\[Sender Name\]/gi,
              val: be,
            },
            {
              pattern:
                /{{sender_email}}|{sender_email}|<primaryemail>|\[Email\]/gi,
              val: we,
            },
            {
              pattern:
                /{{sender_phone}}|{sender_phone}|<contactnumber>|\[Phone\]/gi,
              val: Se,
            },
            {
              pattern: /{{sender_company}}|{sender_company}|<company>/gi,
              val: V,
            },
            { pattern: /{{ender}}|{ender}/gi, val: Q },
          ],
          oe = e.campaigns?.businesses?.signature_template || "";
        let re = F;
        oe &&
          (re +=
            `

` + oe);
        let g = re,
          T = E;
        Ce.forEach((s) => {
          ((g = g.replace(s.pattern, s.val)),
            (T = T.replace(s.pattern, s.val)));
        });
        const je = `https://relay-mailer.com/api/unsubscribe?leadId=${t.id}&campaignId=${e.campaign_id}`;
        g += `

---
<span style="font-size: 10px; color: #999;">To opt out of future emails, please <a href="${je}" style="color: #999; text-decoration: underline;">click here</a>.</span>`;
        const ce = /{{.*?}}|{.*?}|\[.*?\]/g,
          de = (g.match(ce) || []).filter((s) => !s.match(/^\[\s*\]$/)),
          le = T.match(ce) || [];
        if (de.length > 0 || le.length > 0) {
          (console.warn("Found unreplaced placeholders, marking as failed:", [
            ...de,
            ...le,
          ]),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        const { data: me } = await n.rpc("decrypt_password", {
          encrypted_password: a.encrypted_password,
        });
        if (!me) {
          console.error("Failed to decrypt password for account", a.email);
          continue;
        }
        const B = a.email.toLowerCase();
        if (B) {
          const { data: s } = await n.rpc("increment_domain_email_count", {
            p_domain: B,
            p_max_limit: 50,
          });
          if (!s) {
            console.log(`Account limit reached for ${B}.`);
            continue;
          }
        }
        try {
          (await De.createTransport({
            host: a.smtp_host,
            port: a.smtp_port,
            secure: a.smtp_port === 465,
            auth: { user: a.email, pass: me },
          }).sendMail({
            from: a.name ? '"' + a.name + '" <' + a.email + ">" : a.email,
            to: t.email,
            subject: T,
            html: g.replace(/\n/g, "<br/>"),
            text: g,
          }),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          const { data: i } = await n
            .from("scheduled_emails")
            .select("sent_emails")
            .eq("id", e.id)
            .single();
          i &&
            (await n
              .from("scheduled_emails")
              .update({ sent_emails: (i.sent_emails || 0) + 1 })
              .eq("id", e.id));
          const { error: k } = await n
            .from("inbox_emails")
            .insert({
              email_account_id: a.id,
              folder: "sent",
              uid: Math.floor(Math.random() * 1e9),
              from: a.email,
              to: t.email,
              subject: T,
              body_text: g,
              body_html: g.replace(/\n/g, "<br/>"),
              snippet: g.substring(0, 100),
              received_at: new Date().toISOString(),
              is_read: !0,
              campaign_id: e.campaign_id,
              sequence_step: e.templates.name,
            });
          (k
            ? (console.error("\u274C Inbox Insert Failed:", k.message),
              await n
                .from("debug_logs")
                .insert({
                  level: "error",
                  message: `Failed to insert sent email to inbox: ${k.message}`,
                  context: { schedule_id: e.id, lead_id: t.id },
                }))
            : console.log("\u2705 Sent email persisted to inbox."),
            fe++,
            z.push({ email: t.email, status: "sent", from: a.email }));
        } catch (s) {
          (console.error("\u274C Send Failed:", s?.message || s),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
        }
      }
      if (f && f.length > 0) {
        const t = new Date(o.getTime() + (e.interval_minutes || 5) * 6e4);
        await n
          .from("scheduled_emails")
          .update({ scheduled_for: t.toISOString() })
          .eq("id", e.id);
      }
    }
    return JSON.stringify({ success: !0, processed: z });
  } catch (n) {
    return JSON.stringify({ success: false, error: String(n?.message ?? n) });
  }
}
