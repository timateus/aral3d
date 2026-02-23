

# Data Visualization Panel for Aral Sea Map

## Overview
Add a collapsible data visualization panel to the 3D map that displays historical climate and Aral Sea data from the uploaded Excel spreadsheet. The panel will feature interactive charts (using the already-installed Recharts library) and a data table, synchronized with the existing timeline slider.

## Data
The spreadsheet contains two datasets:

**Sheet 1 - Monthly Climate (1996-2025):**
- Avg Temperature, Total Rainfall, Avg Humidity, Groundwater Level

**Sheet 2 - Annual Aral Sea (1925-2024):**
- Sea Level (m), Surface Area (km2), Volume (km3), Salinity (g/L), River Inflow (km3), Cotton Harvest, Irrigated Area, Temperature Anomaly

## Implementation Steps

### 1. Convert Excel data to static JSON files
Create two JSON data files in `public/data/`:
- `karakalpakstan_monthly.json` - monthly climate records
- `aral_sea_annual.json` - annual sea-level/volume/salinity records

This avoids runtime Excel parsing and keeps the app lightweight.

### 2. Create a `DataPanel` component
A new collapsible glass panel (bottom-left of the screen) with two tabs:
- **Sea History** tab: Recharts `AreaChart` showing sea level, volume, and surface area over time (1925-2024). A vertical reference line highlights the currently selected timeline year.
- **Climate** tab: Recharts `LineChart` showing monthly temperature, rainfall, humidity, and groundwater for the selected year (or nearest available year from 1996-2025).

Each tab will also have a small scrollable data table beneath the chart for precise values.

### 3. Integrate with existing state
- The panel reads `waterExtentYear` from Index.tsx to highlight the current year on charts
- A toggle button (chart icon) in the top-right control area opens/closes the panel
- The panel is hidden until the user clicks "Start" (respects `started` state)

### 4. UI/UX Design
- Uses the existing `glass-panel` CSS class for consistent styling
- Compact size (~400px wide, ~300px tall) to avoid obscuring the 3D terrain
- Tabs via Radix Tabs component (already installed)
- Charts use muted colors matching the dark theme (blues, teals, amber)

## Technical Details

### New Files
- `public/data/aral_sea_annual.json` - 100 rows of annual data
- `public/data/karakalpakstan_monthly.json` - ~350 rows of monthly data
- `src/components/DataPanel.tsx` - main panel component with tabs, charts, and table

### Modified Files
- `src/pages/Index.tsx` - add DataPanel component with `waterExtentYear` prop, add toggle button

### Dependencies
No new dependencies needed. Uses existing:
- `recharts` for charts
- `@radix-ui/react-tabs` for tab switching
- Tailwind for styling

