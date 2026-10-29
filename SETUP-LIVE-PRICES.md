# Connecting the Excel workbook (Microsoft Graph)

**Why Graph, not Google Sheets:** the menu already lives in Excel, so Graph keeps one source of truth and the same parser reads both live and local files. Cost: a one-time Azure app registration that needs a Microsoft 365 tenant admin. Google Sheets would be simpler (an API key and a shared sheet) but means converting the workbook and retraining whoever edits prices. If the restaurant uses a *personal* Microsoft account (outlook.com / consumer OneDrive), app-only Graph access is not available; use Google Sheets or ask me to add a delegated-login variant.

1. Put the workbook in OneDrive for Business or a SharePoint library. Edit prices there (Excel online autosaves).
2. https://entra.microsoft.com → Applications → App registrations → New registration → single tenant. Copy the **Application (client) ID** and **Directory (tenant) ID**.
3. Certificates & secrets → New client secret. Copy the **Value** now (shown once).
4. API permissions → Add → Microsoft Graph → **Application permissions** → `Files.Read.All` → **Grant admin consent**. (Narrower alternative: `Sites.Selected` plus a per-site grant; more steps.)
5. In Excel/SharePoint: Share → Copy link. Paste it as `GRAPH_SHARE_URL`. (Or set `GRAPH_DRIVE_ID` + `GRAPH_ITEM_ID`.)
6. Create `.env` from `.env.example`, fill in the values, restart `npm.cmd run dev`.
7. Open http://localhost:8787/api/health. Expect `"mode":"microsoft-graph"` and `"source":"live"`. Then change a price in the workbook and re-open `/api/menu` after `MENU_TTL_SECONDS`.
8. Hosting: deploy to any Node host (Render, Railway, Azure App Service, Fly.io): build command `npm install && npm run build`, start command `npm start`, and set the same variables in the host's environment settings. Never commit `.env`.

Not verified: I could not reach Microsoft from my environment, so steps 2–7 are untested against the real service. The Graph code was tested against a mock of its token and file endpoints.
