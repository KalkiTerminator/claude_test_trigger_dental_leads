# Dental Lead Finder

**An automated lead generation machine that hunts for dental practices across India every Monday and delivers 25 fresh leads straight to your inbox.**

Built with zero servers to manage, zero cron jobs to babysit, and zero manual research. Set it up once, and it works forever.

---

## What It Does

Every Monday at 9:00 AM IST, this automation:

1. **Picks 3 random Indian cities** from a pool of 20 major cities (Mumbai, Delhi, Bangalore, Hyderabad, Chennai, and more)
2. **Searches the web** using Perplexity AI to find dental practices — prioritizing clinics with no website or a weak online presence
3. **Parses and categorizes** the results into "Hot Leads" (no website = ready to pitch) and "Other Leads" (has website = upsell opportunity)
4. **Sends a beautiful email report** with clickable phone numbers, email links, and website URLs — formatted as easy-to-scan cards

You open your inbox Monday morning, and your leads are already waiting.

---

## The Email You Get

The weekly report includes:

- **Dashboard header** — total leads, how many have no website, how many do
- **City tags** — which cities were searched this week
- **Hot Leads section** (red cards) — practices with NO website, your highest-conversion prospects
- **Other Leads section** (green cards) — practices with websites, potential redesign/upgrade clients
- **Each lead card shows** — practice name, full address, clickable phone number, email, and website

Phone numbers are `tel:` links — tap to call directly from your phone.

---

## Tech Stack

Here's every piece of technology used and why:

| Technology | What It Does | Why This One |
|---|---|---|
| **[Trigger.dev](https://trigger.dev)** | Runs the automation on a schedule | Serverless background jobs with built-in cron, retries, and a dashboard. Free tier is generous. No servers to manage. |
| **[Perplexity AI](https://perplexity.ai)** (Sonar model) | Searches the web for dental practices | Unlike traditional search APIs, Perplexity understands context. Ask it "find dental clinics with no website in Pune" and it actually does real-time web research. |
| **[Resend](https://resend.com)** | Sends the email report | Dead simple email API. 100 free emails/day. One API call to send. No SMTP config, no templates to upload. |
| **TypeScript** | The language everything is written in | Type safety catches bugs before they run. Trigger.dev requires it. |
| **Node.js v24 LTS** | Runtime | Latest stable release. Trigger.dev runs on Node. |

### Why NOT These Alternatives?

- **Why not a Python script on a cron job?** — You'd need a server running 24/7, handle failures manually, no retry logic, no dashboard, no logs.
- **Why not Google Maps API for leads?** — It gives you structured data but can't assess website quality. Perplexity can reason about whether a practice has a good online presence.
- **Why not SendGrid for email?** — SendGrid works, but Resend is simpler. One `fetch` call vs. installing an SDK. Free tier is enough for weekly emails.
- **Why not a spreadsheet output?** — Email is faster to act on. You see leads, you call. No extra step of opening a spreadsheet.

---

## Project Structure

```
dental-lead-finder/
|-- .github/
|   |-- workflows/
|       |-- deploy.yml             # Auto-deploys to Trigger.dev on push to main
|-- src/
|   |-- trigger/
|       |-- dental-leads/
|       |   |-- find-leads.ts      # The entire automation — search, parse, email
|       |-- hello-world.ts         # Test task (can be removed)
|-- trigger.config.ts              # Trigger.dev project configuration
|-- tsconfig.json                  # TypeScript compiler settings
|-- package.json                   # Dependencies
|-- .env                           # Your API keys (never committed)
|-- .gitignore                     # Keeps secrets and build artifacts out of git
```

**Yes, the entire automation is one file.** `find-leads.ts` is ~300 lines that handle everything: city selection, web search, JSON parsing, email template, and delivery. No frameworks, no abstractions, no unnecessary complexity.

---

## How The Code Works

Here's a plain-English walkthrough of `src/trigger/dental-leads/find-leads.ts`:

### 1. Schedule Definition
```typescript
export const findDentalLeads = schedules.task({
  id: "find-dental-leads",
  cron: "30 3 * * 1", // Monday 9am IST = 3:30am UTC
```
Trigger.dev uses cron expressions. `30 3 * * 1` means "at minute 30, hour 3 UTC, every Monday." Since IST is UTC+5:30, that's 9:00 AM in India.

### 2. City Randomization
```typescript
const shuffled = [...INDIAN_CITIES].sort(() => Math.random() - 0.5);
const cities = shuffled.slice(0, 3);
```
Each week, 3 cities are randomly picked from a pool of 20. This gives you variety — you're not getting the same Mumbai results every Monday.

### 3. Perplexity Web Search
```typescript
const searchResponse = await fetch("https://api.perplexity.ai/chat/completions", {
  body: JSON.stringify({
    model: "sonar",
    messages: [
      { role: "system", content: "Respond with ONLY a valid JSON array..." },
      { role: "user", content: `Find 25 dental practices in ${cities}...` },
    ],
  }),
});
```
The `sonar` model does live web search. The system prompt forces it to return structured JSON instead of prose. The user prompt asks for clinics with weak or missing websites — your best sales targets.

### 4. Resilient JSON Parsing
```typescript
// Strip markdown code fences if present
let cleaned = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
```
AI models sometimes wrap JSON in markdown code blocks or return truncated responses. The parser handles both cases — it strips code fences and can recover partial results from truncated JSON.

### 5. Email Delivery
```typescript
await fetch("https://api.resend.com/emails", {
  body: JSON.stringify({
    from: "Dental Lead Finder <onboarding@resend.dev>",
    to: ["your@email.com"],
    subject: `25 Dental Leads — Mumbai, Delhi, Pune`,
    html: emailHtml,
  }),
});
```
One API call. The HTML email template is built inline with card-based layouts, clickable phone links, and color-coded sections.

---

## Setup Guide (15 Minutes)

### Prerequisites

- **Node.js v24 LTS** — [Download here](https://nodejs.org)
- **A Trigger.dev account** — [Sign up free](https://cloud.trigger.dev)
- **A Perplexity API key** — [Get one here](https://www.perplexity.ai/api-settings) (pay-as-you-go, ~$0.01 per search)
- **A Resend API key** — [Sign up free](https://resend.com) (100 emails/day free)

### Step 1: Clone and Install

```bash
git clone git@github.com:KalkiTerminator/claude_test_trigger_dental_leads.git
cd claude_test_trigger_dental_leads
npm install
```

### Step 2: Configure Environment

Create a `.env` file in the project root:

```env
# Trigger.dev — get from: cloud.trigger.dev -> your project -> API Keys
TRIGGER_SECRET_KEY=tr_dev_your_key_here

# Perplexity — get from: perplexity.ai/api-settings
PERPLEXITY_API_KEY=pplx-your_key_here

# Resend — get from: resend.com -> API Keys
RESEND_API_KEY=re_your_key_here
```

### Step 3: Update the Email Recipient

In `src/trigger/dental-leads/find-leads.ts`, change the email address on line 110:

```typescript
to: ["your-email@example.com"],  // <-- put your email here
```

### Step 4: Test Locally

```bash
npx trigger.dev@latest dev
```

Then go to your [Trigger.dev dashboard](https://cloud.trigger.dev), click **Tasks** > `find-dental-leads` > **Test** > **Run test**.

Check your inbox. You should receive a leads report within 15 seconds.

### Step 5: Deploy to Production

**1. Add env vars to Trigger.dev dashboard:**
- Go to **cloud.trigger.dev** > your project > **Environment Variables**
- Add `PERPLEXITY_API_KEY` and `RESEND_API_KEY` to **Production**

**2. Add deploy token to GitHub:**
- Go to **cloud.trigger.dev/account/tokens** and create a Personal Access Token (starts with `tr_pat_`)
- Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**
- Add a secret named `TRIGGER_PAT` with the token value

**3. Push to deploy:**
```bash
git push origin main
```

GitHub Actions automatically deploys to Trigger.dev on every push to `main`. Check the **Actions** tab for deploy status.

Done. It will now run automatically every Monday at 9am IST.

---

## Customization

### Change the target industry

Edit the Perplexity prompt in `find-leads.ts` (line 42). Replace "dental practices/clinics" with any business type:

```
"Find 25 veterinary clinics in these Indian cities..."
"Find 25 restaurants without a website in these Indian cities..."
"Find 25 law firms in these Indian cities..."
```

### Change the cities

Edit the `INDIAN_CITIES` array at the top of the file. Add, remove, or replace with any cities worldwide:

```typescript
const CITIES = [
  "London", "Manchester", "Birmingham", "Leeds", "Glasgow",
];
```

### Change the schedule

Edit the cron expression on line 12:

| Schedule | Cron |
|---|---|
| Every Monday 9am IST | `"30 3 * * 1"` |
| Every day 9am IST | `"30 3 * * *"` |
| Every weekday 8am IST | `"30 2 * * 1-5"` |
| Twice a week (Mon & Thu) | `"30 3 * * 1,4"` |

### Change the number of leads

Edit the Perplexity prompt — change "25" to whatever number you want. Keep it under 50 for best results.

---

## Cost

Running this automation costs almost nothing:

| Service | Cost |
|---|---|
| Trigger.dev | Free tier — 50,000 compute seconds/month (this task uses ~15 seconds per run) |
| Perplexity API | ~$0.01-0.02 per search (one search per week = ~$0.04-0.08/month) |
| Resend | Free — 100 emails/day (you send 1 per week) |
| **Total** | **< $0.10/month** |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "PERPLEXITY_API_KEY is not set" | Add the key to both `.env` (local) AND Trigger.dev dashboard (production) |
| "RESEND_API_KEY is not set" | Same — add to both places |
| Email not arriving | Check spam folder. Resend's free tier sends from `onboarding@resend.dev` which some providers flag |
| "Failed to parse leads JSON" | Perplexity occasionally returns non-JSON. The automation handles this gracefully and sends raw results instead |
| 0 leads found | Try running again — web search results vary. If persistent, check that your Perplexity API key is valid |

---

## Built With

This project was built using **Claude Code** (Anthropic's AI coding agent) in a single session — from `npm init` to production deployment.

The entire workflow: project setup, API research, code generation, debugging, email template design, testing, and deployment was done conversationally with an AI pair programmer.

---

## License

MIT. Use it, modify it, sell it, whatever. Go find some leads.
