# PLUGTHENATION LTD (PTN) — Conglomerate Structural Map

> **Company Outline & Operational Directives**
> PTN is the parent corporation overseeing a portfolio of specialized sub-companies, directing automated operations, system development, and high-volume media curation.

---

## 1. Corporate Architecture

PTN acts as the central hub for innovation, system development, and workflow automation. It operates two primary sub-companies:

```mermaid
graph TD
    PTN[PLUGTHENATION LTD] --> Relay[Relay Solutions]
    PTN --> Scheduler[Scheduler: The Label]
    Relay --> RelayOps[B2B Lead Gen & Systems Dev]
    Scheduler --> ContentOps[Aesthetic Curation & Social Media Auto]
```

---

## 2. Sub-Companies

### 2.1 Relay Solutions
* **Focus:** B2B Freelance Automation, Systems Development, and Lead Generation.
* **Core Systems:**
  * **Private Lead Scraper**: A Puppeteer-based crawler designed to harvest leads from directories and search results.
  * **Lead Validator**: An email verification service verifying MX records and domain deliverability.
  * **Email Orchestrator**: An Express-based mail daemon utilizing pg_cron to schedule and deploy automated B2B outreach campaigns.
* **Operational Directive**: Deploy autonomous AI agents to research markets, scrape leads, and generate personalized, high-conversion email sequences to secure development contracts.

---

## 3. Technology & Automation Standards

Across all subsidiaries, PTN mandates the following operational principles:
1. **Autonomous Agency**: Operations must run via cooperating AI agent networks to eliminate manual bottlenecks.
2. **Quality Control**: All outbound communication (email or social media) must adhere to rigorous quality guidelines, strict length and tone rules, and GDPR constraints.
3. **Data Integrity**: Global deduplication and strict validation check steps must run before any outreach or post publishing.
