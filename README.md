# Hakemate 3.0

> **AI Teammate Finder for Hackathons**  
> Built for International Hackathon 5.0 — Domain 4: ACE TeamUp Challenge  
> **Team Hakemate (Rathinam Technical Campus):** Lohith K, Nigun S, John Christ S, Kumar C  

Hakemate is an intelligent hackathon team-building platform designed to help students discover compatible teammates based on complementary skills, working styles, schedule availability, and event goals.

---

## The Website Experience

Hakemate provides an end-to-end journey for hackathon participants:

* **Guided Onboarding:** Students set up their profile in minutes—selecting skills, interest domains, hackathon experience level, and availability windows.
* **College & Region Autocomplete:** Seamlessly search across over 70,000 Indian higher education institutions powered by the AISHE directory.
* **GitHub Skill Import:** Analyze public GitHub repositories to automatically extract and verify technical skills and language proficiencies.
* **Event-Aware Team Discovery:** Explore hackathons, find open teams, or invite builders directly matched to specific competition requirements.
* **Collaboration Workspace:** Every team gets a dedicated collaboration hub with real-time team chat and a Kanban task board (To Do, Doing, Done).
* **Community & Gamification:** Engage in topic hubs, share project showcases, give kudos, earn XP, unlock 24 achievement badges, and climb the leaderboard.

---

## How the Team DNA Matching Engine Works

At the heart of Hakemate is the **Team DNA Engine**, an algorithm that calculates compatibility between students and teams on a 100-point scale:

| Component | Weight | Criteria |
|---|:---:|---|
| **Skill Complementarity** | **30 pts** | Evaluates which required skills the candidate covers that the user or team is currently missing. |
| **Meaning & Interest Match** | **30 pts** | Computes semantic similarity across project interests, problem statements, and bio themes. |
| **Schedule Availability** | **15 pts** | Calculates temporal overlap across preferred working slots (weekends, weekday evenings, late nights, etc.). |
| **Event Mode & Location** | **15 pts** | Matches preference for online vs. in-person participation, with regional proximity bonuses for nearby teammates. |
| **Experience Balance** | **10 pts** | Optimizes team dynamics by pairing experienced hackathon veterans with fresh, energetic contributors. |

Every recommendation provides a visual **Team DNA strand** and natural-language explanations highlighting exactly why two builders make a great pair.

---

## Community & Gamification

To encourage ongoing collaboration and peer recognition, Hakemate incorporates game mechanics:

* **Domain Hubs:** Dedicated discussion spaces for AI/ML, Web Builders, Cyber Security, Hardware/IoT, Design, and First-Time Hackers.
* **Community Feed:** Post team updates, showcases, and requests with interactive replies and kudos.
* **XP & Levels:** Earn experience points for meaningful contributions (forming teams, sharing knowledge, endorsing peers). User level dynamically scales and renders as an avatar ring.
* **Achievement Badges:** 24 tiered badges across Bronze, Silver, Gold, and Platinum tiers awarded automatically by system milestones.
* **Activity Heatmap & Leaderboards:** Track hackathon engagement and community activity over time.

---

## Architecture & Technology Stack

* **Frontend:** React (Vite), SPA architecture with responsive CSS design and Lucide icons.
* **Backend & Serverless Functions:** Node.js serverless functions handling natural-language query extraction and college search indexing.
* **Database & Authentication:** Supabase (PostgreSQL with Row Level Security, database triggers, and pgvector embeddings).
* **Security & Privacy:** Contact details (email, phone) remain private and unlock only after team invitations are mutually accepted. Granular Row-Level Security policies ensure all data access is strictly authenticated.
