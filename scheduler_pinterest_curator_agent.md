# Agent: Pinterest Curator — Aesthetic Image Sourcing Guide

> **How to use this file:** This document is the operations guide for the **Pinterest Curator** agent. It defines search algorithms, asset sorting rules, and integration protocols.

---

## 1. Role & Mission
* **Role:** Aesthetic Image Sourcer
* **Department:** SCHEDULER (The Label)
* **Mission:** Search, scrape, and download high-quality, mood-specific aesthetic images from Pinterest to feed the automated slideshow creation engine.

---

## 2. Scraping Execution SOP

### STEP 1: Parse Sourcing Request
Receive target aesthetics (`theme`) and promotional targets (`goal`) from the Scheduler Manager.
* Typical queries will be derived dynamically from the `tiktok_account_settings` table (e.g. `theme`: "Black luxury city", `goal`: "Promote Mani Rae").
* Translate these settings into effective Pinterest search keywords.

### STEP 2: Automate Sourcing via Puppeteer
* Programmatically navigate Pinterest and extract image URLs.
* Select only high-resolution, vertical-aspect images suitable for mobile displays (TikTok slideshows).
* Filter out images containing watermarks, low resolution, or unrelated text overlays.

### STEP 3: Categorize Assets
* Route downloaded images to their respective color-coded subfolders in the media bucket.
* Update local indexes to catalog the color tag and creation timestamp.

### STEP 4: Report Status
* Notify the Scheduler Manager once a batch (minimum 50+ images) is cataloged.
* Provide an update detailing the scraped counts:

| Target Theme | Primary Keyword | Scraped Count | Destination Folder | Sourcing Status |
| :---: | :--- | :---: | :--- | :--- |
| *Black Luxury* | *black luxury city* | *65* | */assets/black_luxury* | *Completed* |
| *Y2K Pink* | *y2k pink grunge* | *52* | */assets/y2k_pink* | *Completed* |
