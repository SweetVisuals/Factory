# Frontend & Architecture Plan

## Overview
A real-time, interactive dashboard that visualizes the Openclaw agents as workers in an office using 128x128 pixel art sprites.

## Tech Stack
- **Frontend:** React (Vite/Next.js) + Tailwind CSS (configured for no borders, specific aesthetic).
- **Backend/State:** Supabase + Supabase MCP (Model Context Protocol).
- **Agent Framework:** Openclaw.

## Visuals (128x128 Pixel Art)
- **The Office:** An isometric or top-down 2D grid.
- **Workers (Agents):** 
  - **Idle:** Sitting at a desk, drinking coffee, or waiting.
  - **Working:** Typing rapidly, moving between desks, carrying files.
- **Departments:** Distinct visual zones (e.g., Engineering has servers, Design has drawing boards).

## Pages (Zero-Border Aesthetic)
1. **Discover:** See the log of all past and current company projects.
2. **Dashboard:** The main view. The pixel-art office where you interact with The Boss and watch tasks happen in real-time.
3. **Profile:** Manage the business plan, agent instructions, and overall settings.
