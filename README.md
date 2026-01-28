<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1R08GICeC1iDZMdOT5OTH8Sxrsabl8Hvf

## Run Locally

**Voraussetzungen:** Node.js (z. B. von [nodejs.org](https://nodejs.org))

### Option A: Per Doppelklick (empfohlen unter Windows)

1. Im Projektordner **`run-dev.bat`** doppelklicken.
2. Warten, bis im Fenster `Local: http://localhost:3000` erscheint.
3. Im Browser **http://localhost:3000** öffnen – die EquiManage-UI erscheint.

### Option B: Über die Kommandozeile

1. Im Projektordner ein Terminal öffnen (z. B. in Cursor: **Terminal → Neues Terminal** oder Rechtsklick auf den Ordner → **„Im integrierten Terminal öffnen“**).
2. Abhängigkeiten installieren (falls noch nicht geschehen):
   ```bash
   npm install
   ```
3. Dev-Server starten:
   ```bash
   npm run dev
   ```
4. Im Browser **http://localhost:3000** öffnen.

### Supabase (Auth & Datenbank, **erforderlich**)

1. **Projekt in Supabase** anlegen (falls noch nicht geschehen).
2. **Datenbank einrichten** – Anleitung und SQL siehe **[`supabase/DATENBANK-ANLEITUNG.md`](supabase/DATENBANK-ANLEITUNG.md)**. Dort werden Tabellen (`stables`, `profiles`, `horses`), RLS und Beispiel-Ställe beschrieben.
3. **`.env.local`** im Projektroot anlegen:
   ```env
   VITE_SUPABASE_URL=https://dein-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=dein-anon-key
   ```
   Werte aus **Supabase Dashboard → Settings → API** übernehmen.

### Optionale Konfiguration

- **Gemini / Claude API:** Für KI-Funktionen `GEMINI_API_KEY` bzw. `CLAUDE_API_KEY` in `.env.local` setzen.

---

## Nächste Schritte (AI-Studio → Browser)

Damit die mit Google AI Studio erstellte UI im Browser läuft, wurde Folgendes umgesetzt:

- **`index.css`** angelegt (wird von `index.html` eingebunden).
- **Import-Map entfernt** – Vite übernimmt das Bundling (React, etc.) aus `node_modules`.
- **Vite-Dev-Server** nutzt Port **3000** (`vite.config.ts`).

Zum Testen **`run-dev.bat`** ausführen oder `npm run dev` im Projektordner, dann **http://localhost:3000** im Browser öffnen.
