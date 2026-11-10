# RunMetrics v3 — Final Product Specification

Status: APPROVED (2026-11-10)

## Product decisions
- AI Coach: Hybrid (deterministic rules and optional AI explanations/recommendations; no fabricated metrics)
- Access: Private, single user initially; Supabase Auth and row-level security
- Theme: Modern dark, responsive
- Scope: All 42 approved features retained; Shoe Tracker excluded
- Primary data: Garmin; Strava secondary with cross-source deduplication
- Main goal: JRF 2027 Full Marathon 3:45:00 (~5:20/km); goal is not a performance prediction
- Workout push: Explicit approval before any supported outbound sync; Garmin Personal API may not support workout push
- Operational LTHR: 181 bpm, editable and effective-dated; separately record Garmin-reported values
- Training frequency preference: 4 runs/week; threshold pace editable

## Navigation and feature inventory (42)
### Overview (5)
1. Training Status & Weekly Summary
2. Main Race Goal Progress
3. Next Workout & Weekly Schedule
4. Recent Activities
5. Recovery & Training Alerts
### Activities (6)
6. Activity History & Search
7. Activity Detail & Analysis
8. FIT File Upload
9. Workout Execution: Target vs Actual
10. Route & Elevation Analysis
11. Weather Impact
### Performance Analytics (6)
12. Aerobic Efficiency
13. Performance Trend
14. HR & Pace Zones
15. Power & Cadence Analysis
16. Personal Records
17. Monthly & Yearly Report
### AI Running Coach (6)
18. Weekly Training Insights
19. Hybrid Training Journal
20. Adaptive Workout Recommendations
21. Training Compliance Score
22. Fatigue & Recovery Insights
23. Explainable Recommendations
### Training Center (6)
24. Training Plan & Periodization
25. Weekly Workout Builder
26. Training Load & Recovery
27. Fueling Tracker
28. Garmin Workout Center
29. Workout Approval & Sync Status
### Race Management (6)
30. Race Calendar & Goals
31. Race Predictor
32. Race Readiness
33. Race Strategy Builder
34. Race Fueling Plan
35. Post-Race Report
### Settings & Integrations (6)
36. Editable Training Profile
37. Effective-Dated LTHR & Threshold Pace
38. Garmin Connect Integration
39. Strava Integration
40. Data Import & Deduplication
41. Privacy & Data Export

Note: This enumerated navigation inventory contains **41** features, not 42; the earlier UI stated 42 in error. Do not silently invent a 42nd feature. Product owner approved all listed features.

## Engineering principles
- Original FIT preserved securely for re-analysis; parse sessions/laps/records/events and GPS when present.
- Provider-neutral normalized activity model; deduplicate provider IDs and cross-provider matching.
- Respect data quality, environment, and comparable efforts in analytics.
- Effective-dated training profile, zones and threshold values; avoid retroactive changes to historical interpretation.
- Never show demo data as live, never show disconnected integrations as connected.
- Secrets server-side only, no API credentials in public repository or browser bundle.
- No Garmin workout push without a supported authorized API and renewed user approval after any changes.
- Free-tier-first infrastructure, but no guarantee of perpetual free hosting.

## Delivery phases
1. Working MVP: private login, dark dashboard, profile, FIT upload, activities, HR/pace zones, Supabase persistence.
2. Training Intelligence: trends, journal, plans, compliance, race predictor, fueling, reporting.
3. Advanced Intelligence: adaptive coach, route/weather, provider integrations, workout approvals, advanced race strategy.

Features not yet implemented must be marked Coming Soon, not presented as functional.
