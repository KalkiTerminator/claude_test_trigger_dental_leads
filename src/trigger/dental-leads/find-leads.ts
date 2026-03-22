import { schedules } from "@trigger.dev/sdk/v3";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
  "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow",
  "Chandigarh", "Kochi", "Indore", "Nagpur", "Bhopal",
  "Coimbatore", "Visakhapatnam", "Surat", "Vadodara", "Thiruvananthapuram",
];

export const findDentalLeads = schedules.task({
  id: "find-dental-leads",
  cron: "30 3 * * 1", // Every Monday at 9am IST (3:30am UTC)

  run: async () => {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY is not set");

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");

    const emailTo = process.env.LEAD_EMAIL_RECIPIENT;
    if (!emailTo) throw new Error("LEAD_EMAIL_RECIPIENT is not set");

    // Pick 3 random cities each week for variety
    const shuffled = [...INDIAN_CITIES].sort(() => Math.random() - 0.5);
    const cities = shuffled.slice(0, 3);

    console.log(`Searching for dental leads in: ${cities.join(", ")}`);

    // Search for dental practices using Perplexity
    const searchResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a lead research assistant. Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation text before or after. Each object must have these exact keys: name, city, address, phone, website (use null if none), email (use null if none).",
          },
          {
            role: "user",
            content: `Find 25 dental practices/clinics in these Indian cities: ${cities.join(", ")}. Focus on practices that appear to have no website or a very basic/outdated online presence — these are the best leads for selling web design services. Return exactly 25 results as a JSON array.`,
          },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Perplexity API error (${searchResponse.status}): ${errorText}`);
    }

    const searchData = await searchResponse.json();
    const rawContent = searchData.choices[0].message.content;
    const citations = searchData.citations || [];

    console.log("Perplexity response received, parsing leads...");

    // Parse the JSON from the response
    let leads: Array<{
      name: string;
      city: string;
      address: string;
      phone: string;
      website: string | null;
      email: string | null;
    }>;

    try {
      // Strip markdown code fences if present
      let cleaned = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      // Extract JSON array
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        leads = JSON.parse(jsonMatch[0]);
      } else {
        // Response may be truncated — try to salvage by closing the array
        const arrayStart = cleaned.indexOf("[");
        if (arrayStart === -1) throw new Error("No JSON array found");
        let partial = cleaned.slice(arrayStart);
        // Find the last complete object (ends with })
        const lastBrace = partial.lastIndexOf("}");
        if (lastBrace === -1) throw new Error("No complete JSON objects found");
        partial = partial.slice(0, lastBrace + 1) + "]";
        leads = JSON.parse(partial);
        console.log(`Recovered ${leads.length} leads from truncated response`);
      }
    } catch (e) {
      console.error("Failed to parse leads JSON. Raw response:", rawContent);
      leads = [];
    }

    console.log(`Found ${leads.length} leads`);

    // Build email HTML
    const emailHtml = buildEmailHtml(leads, cities, rawContent, citations);

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dental Lead Finder <onboarding@resend.dev>",
        to: [emailTo],
        subject: `🦷 ${leads.length} Dental Leads — ${cities.join(", ")} (${new Date().toLocaleDateString("en-IN")})`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error (${emailResponse.status}): ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log(`Email sent successfully! ID: ${emailResult.id}`);

    return {
      leadsFound: leads.length,
      cities,
      emailId: emailResult.id,
    };
  },
});

function buildLeadCard(lead: { name: string; city: string; address: string; phone: string; website: string | null; email: string | null }, index: number, isHot: boolean): string {
  const badgeColor = isHot ? "#dc2626" : "#16a34a";
  const badgeText = isHot ? "NO WEBSITE" : "HAS WEBSITE";
  const cardBorder = isHot ? "#fecaca" : "#bbf7d0";
  const cardBg = isHot ? "#fef2f2" : "#f0fdf4";

  const phoneLink = lead.phone ? `<a href="tel:${escapeHtml(lead.phone.replace(/\s/g, ""))}" style="color: #2563eb; text-decoration: none;">${escapeHtml(lead.phone)}</a>` : "—";
  const emailLink = lead.email ? `<a href="mailto:${escapeHtml(lead.email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(lead.email)}</a>` : "";
  const websiteLink = lead.website ? `<a href="${escapeHtml(lead.website)}" style="color: #2563eb; text-decoration: none; word-break: break-all;">${escapeHtml(lead.website)}</a>` : "";

  return `
    <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 12px; padding: 20px; margin-bottom: 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display: inline-block; background: #1e293b; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: bold; margin-right: 10px; vertical-align: middle;">${index}</span>
            <span style="font-size: 18px; font-weight: 700; color: #0f172a; vertical-align: middle;">${escapeHtml(lead.name)}</span>
          </td>
          <td style="text-align: right;">
            <span style="display: inline-block; background: ${badgeColor}; color: white; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;">${badgeText}</span>
          </td>
        </tr>
      </table>
      <div style="margin-top: 14px; padding-left: 38px;">
        <table cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #334155;">
          <tr>
            <td style="padding: 3px 0; width: 24px; vertical-align: top;">&#128205;</td>
            <td style="padding: 3px 0; padding-left: 6px;">${escapeHtml(lead.city)} &mdash; ${escapeHtml(lead.address)}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; width: 24px; vertical-align: top;">&#128222;</td>
            <td style="padding: 3px 0; padding-left: 6px;">${phoneLink}</td>
          </tr>
          ${emailLink ? `
          <tr>
            <td style="padding: 3px 0; width: 24px; vertical-align: top;">&#9993;</td>
            <td style="padding: 3px 0; padding-left: 6px;">${emailLink}</td>
          </tr>` : ""}
          ${websiteLink ? `
          <tr>
            <td style="padding: 3px 0; width: 24px; vertical-align: top;">&#127760;</td>
            <td style="padding: 3px 0; padding-left: 6px;">${websiteLink}</td>
          </tr>` : ""}
        </table>
      </div>
    </div>`;
}

function buildEmailHtml(
  leads: Array<{ name: string; city: string; address: string; phone: string; website: string | null; email: string | null }>,
  cities: string[],
  rawContent: string,
  citations: string[],
): string {
  const date = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (leads.length === 0) {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; padding: 24px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #0f172a; font-size: 22px; margin: 0 0 8px;">Dental Leads Report</h1>
          <p style="color: #64748b; margin: 0 0 20px;">${date} &mdash; ${cities.join(", ")}</p>
          <p style="color: #334155;">Could not parse structured leads. Raw results:</p>
          <pre style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 13px; color: #334155; overflow-x: auto;">${escapeHtml(rawContent)}</pre>
        </div>
      </div>`;
  }

  const noWebsiteLeads = leads.filter((l) => !l.website);
  const withWebsiteLeads = leads.filter((l) => l.website);

  const hotCards = noWebsiteLeads.map((lead, i) => buildLeadCard(lead, i + 1, true)).join("");
  const otherCards = withWebsiteLeads.map((lead, i) => buildLeadCard(lead, noWebsiteLeads.length + i + 1, false)).join("");

  const citationsList = citations.length > 0
    ? `<div style="margin-top: 24px; padding: 16px; background: #f1f5f9; border-radius: 10px;">
        <p style="font-size: 12px; font-weight: 600; color: #64748b; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Sources</p>
        ${citations.map((c) => `<a href="${escapeHtml(c)}" style="display: block; font-size: 12px; color: #2563eb; text-decoration: none; margin-bottom: 4px; word-break: break-all;">${escapeHtml(c)}</a>`).join("")}
       </div>`
    : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; padding: 0;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 40px 32px 32px; border-radius: 0 0 24px 24px;">
        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Weekly Report</p>
        <h1 style="color: white; font-size: 26px; margin: 0 0 16px; font-weight: 800;">Dental Practice Leads</h1>
        <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 20px;">${date}</p>

        <!-- Stats -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width: 33%; text-align: center; padding: 12px 8px;">
              <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 16px 8px;">
                <div style="font-size: 28px; font-weight: 800; color: white;">${leads.length}</div>
                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Total Leads</div>
              </div>
            </td>
            <td style="width: 33%; text-align: center; padding: 12px 8px;">
              <div style="background: rgba(220, 38, 38, 0.2); border-radius: 12px; padding: 16px 8px;">
                <div style="font-size: 28px; font-weight: 800; color: #fca5a5;">${noWebsiteLeads.length}</div>
                <div style="font-size: 11px; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">No Website</div>
              </div>
            </td>
            <td style="width: 33%; text-align: center; padding: 12px 8px;">
              <div style="background: rgba(22, 163, 74, 0.2); border-radius: 12px; padding: 16px 8px;">
                <div style="font-size: 28px; font-weight: 800; color: #86efac;">${withWebsiteLeads.length}</div>
                <div style="font-size: 11px; color: #86efac; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Has Website</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Cities -->
        <div style="margin-top: 16px; text-align: center;">
          ${cities.map((c) => `<span style="display: inline-block; background: rgba(255,255,255,0.15); color: #e2e8f0; font-size: 12px; padding: 4px 12px; border-radius: 20px; margin: 3px;">${c}</span>`).join("")}
        </div>
      </div>

      <!-- Body -->
      <div style="padding: 28px 20px;">

        ${noWebsiteLeads.length > 0 ? `
          <div style="margin-bottom: 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
              <tr>
                <td>
                  <span style="font-size: 18px; font-weight: 700; color: #0f172a;">Hot Leads</span>
                </td>
                <td style="text-align: right;">
                  <span style="font-size: 12px; color: #dc2626; font-weight: 600;">NO WEBSITE &mdash; READY TO PITCH</span>
                </td>
              </tr>
            </table>
            ${hotCards}
          </div>
        ` : ""}

        ${withWebsiteLeads.length > 0 ? `
          <div style="margin-bottom: 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
              <tr>
                <td>
                  <span style="font-size: 18px; font-weight: 700; color: #0f172a;">Other Leads</span>
                </td>
                <td style="text-align: right;">
                  <span style="font-size: 12px; color: #16a34a; font-weight: 600;">HAS WEBSITE &mdash; UPSELL OPPORTUNITY</span>
                </td>
              </tr>
            </table>
            ${otherCards}
          </div>
        ` : ""}

        ${citationsList}
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px 32px 32px;">
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">Automated by Dental Lead Finder &mdash; delivered every Monday at 9am IST</p>
        </div>
      </div>

    </div>`;
}
