# Design System Strategy: CrowdShield AI Telemetry

## 1. Overview & Creative North Star
The Creative North Star for CrowdShield AI is **"Autopilot for Stadium Operations."** The interface borrows heavily from Palantir Gotham, Bloomberg Terminal, Formula 1 telemetry dashboards, and modern smart city digital twin systems. It is high-contrast, density-packed, and real-time. We prioritize high information density, dark command-center aesthetics, and glowing operational status indicators.

---

## 2. Color Palette & Accents
Our color system is built for low-light command center environments, optimizing readability and reducing eye strain during multi-hour operations.

### Dark Mode Base
- **Base Background (`background`):** `#0D1B2A` (Deep Space Navy)
- **Card/Surface Background (`surface`):** `#1B263B` (Command Slate)
- **Elevated Surfaces (`surface-container-high`):** `#415A77` (Muted Steel)

### Accents & Status Indicators
- **Primary Brand (`primary`):** `#00F5D4` (Glowing Neon Teal) - Used for systems online, active routes, and navigation overlays.
- **Normal/Safe State (`success`):** `#22C55E` (Signal Green) - Occupancy < 60%.
- **Warning/Surge State (`warning`):** `#F59E0B` (Amber Alert) - Occupancy 60–85%.
- **Critical/Incident State (`error`):** `#EF4444` (Critical Red) - Occupancy > 85%, stampede risk, active fires, or medical emergencies.

---

## 3. Typography: The Telemetry Voice
We use typography to differentiate live, changing data from static labels.

- **Display & Live Data:** **JetBrains Mono** - A highly readable monospaced font. Used for numeric counts, wait times, GPS coordinates, occupancy rates, timers, and telemetry metrics.
- **Body & Controls:** **Inter** - A clean, neutral sans-serif. Used for announcements, incident logs, configuration screens, settings, and navigation labels.

---

## 4. Layout & Grid Rules
- **Grid Layout:** Dashboards use a standard 12-column grid. The primary view (Stadium Map) occupies a large central canvas (7 or 8 columns), flanked by Alert Feeds (3 columns) and Telemetry Widgets (2 columns).
- **The Telemetry Container:** Cards must have thin borders (`1px solid #415A77`) with a subtle glow or inner-shadow if the status is warning/error.
- **Glassmorphism:** Overlays (e.g. emergency trigger panels) use `#1B263B` at 80% opacity with a `16px` backdrop-blur.

---

## 5. Components & Interactions

### Live Telemetry Cards
- Monospaced big values (e.g. `92.4%`).
- Small mini-charts (sparklines) indicating density over time.
- Status dots (`●`) pulsing to indicate live connection.

### Status Badges
- Color-coded by state (Green, Amber, Red).
- Monospaced text for gate numbers (e.g., `GATE C3`).

### Emergency Action Drawer
- High-visibility red backdrop.
- Immediate actions disabled / locked once triggered.
- Evacuation countdown timer displayed in extra-large monospace.
