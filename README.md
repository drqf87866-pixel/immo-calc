# Immo-Calc

Rendite-Kalkulationstool für Kapitalanlage-Immobilien. Läuft komplett auf Cloudflare (ein Worker mit Static Assets + D1 + Groq), kein separates Backend, keine klassische Anmeldung.

**Live-URL:**
- Komplettes Projekt (Frontend + API): `https://immo-calc.drqf87866.workers.dev`

---

## Tech-Stack

| Baustein | Technologie |
|---|---|
| Backend | Cloudflare Worker (TypeScript) |
| Datenbank | Cloudflare D1 (SQLite) |
| Frontend | Statisches HTML/CSS/JS, als Static Assets direkt vom Worker serviert |
| KI | Cloudflare Workers AI (Modell aktuell in Feinjustierung, siehe unten) |
| Nutzertrennung | Gast-ID im Browser (kein Login) |

---

## Umgesetzte Funktionen

### Rendite-Rechner
- Objekt-Parameter (Bezeichnung, Kaufpreis, Wohnfläche, Kaltmiete) und Finanzierungs-Parameter (Eigenkapital, Zinssatz, Tilgungssatz, Kaufnebenkosten, AfA-Satz, Gebäudeanteil, Steuersatz) getrennt im Formular
- Kaufnebenkosten als Regler (5–15 %), bewusst ohne Bundesland-Logik (siehe "Gestrichen")
- Berechnete Kennzahlen:
  - Kaufpreisfaktor
  - Kapitaldienstdeckungsgrad (DSCR)
  - Bruttomietrendite / Nettomietrendite
  - Kaufpreis pro m²
  - Cashflow vor Steuern (monatlich, mit Zins-/Tilgungs-Aufschlüsselung)
  - GuV-Sicht: Mieteinnahmen, Zinsen, AfA, steuerlicher Gewinn/Verlust, Steuerzahlung **oder** -erstattung (mit passendem Vorzeichen/Farbe), Cashflow nach Steuern
  - Eigenkapitalrendite vor und nach Steuern

### Objekt-Verwaltung
- Objekte werden zentral angelegt (Bezeichnung, Kaufpreis, Wohnfläche, Kaltmiete sind fest am Objekt, nicht mehr pro Kalkulation frei eingebbar)
- Auswahl per Dropdown im Rechner; bei Auswahl werden die Objekt-Felder automatisch befüllt und schreibgeschützt
- Bearbeiten-Modus (Felder wieder editierbar) und Löschen (Papierkorb-Icon neben der Auswahl, inkl. Sicherheitsabfrage; löscht zugehörige Kalkulationen mit)

### Verlauf
- Liste aller gespeicherten Kalkulationen, per Dropdown nach Objekt filterbar
- Klick auf einen Eintrag zeigt die vollständige Ergebnisansicht erneut (Werte werden aus den gespeicherten Eingaben neu berechnet, nicht separat dupliziert gespeichert)
- Checkbox-Auswahl von bis zu 3 Einträgen → Vergleichsansicht mit vollständiger Cashflow-/GuV-Aufschlüsselung nebeneinander

### KI-Einschätzung
- Pro Berechnung bewertet ein KI-Modell jede Kennzahl einzeln (1 Satz, praktische Konsequenz statt nur "gut/schlecht")
- Feste, recherchierte Richtwerte für den deutschen Markt sind im Prompt hinterlegt (z. B. Kaufpreisfaktor bis 20 günstig, Metropolen 25–45 normal), damit das Modell nicht raten muss
- Werte + KI-Text werden gemeinsam in 8 Kennzahl-Kacheln auf der Ergebnisseite angezeigt (siehe Design)
- **Modell-Historie (mehrfach getauscht, siehe "Offene Punkte"):** Cloudflare Llama 3.1 8B → Groq (Llama 3.3 70B → GPT-OSS 120B) → zurück zu Cloudflare, dort mehrere Modelle durchprobiert

### Design
- Eigenes Layout ("Klar"-Stil): helles Fintech-Minimal, Inter-Schrift, ein Indigo-Akzent, große fette Kennzahlen
- Formular in zwei Zeilen: Objekt-Parameter, darunter Finanzierungs-Parameter
- 8 Kennzahl-Kacheln (paarweise: Kaufpreisfaktor+DSCR, Brutto+Netto, Cashflow vor+nach Steuern, EK-Rendite vor+nach Steuern), jede mit Label, großer Zahl und KI-Satz
- Eingabe-Box (Kaufpreis, Eigenkapital, Zinssatz, Tilgung) auf Ergebnis- und Vergleichsseite

### Nutzertrennung ohne Login
- Beim ersten Seitenaufruf wird automatisch eine zufällige Gast-ID im Browser (`localStorage`) erzeugt und bei jeder API-Anfrage als Header mitgeschickt
- Alle Datenbank-Abfragen sind nach dieser ID gefiltert – andere Besucher der URL sehen ihre eigenen, leeren Daten
- "Zugangscode anzeigen" / "Anderen Code verwenden" erlaubt es, dieselben Daten bewusst auf einem zweiten Gerät zu laden
- **Wichtig:** Das ist keine echte Sicherheit (kein Passwort), sondern eine pragmatische Trennung für den Alltag – wer den Code kennt, kommt an die Daten

---

## Gestrichene / verworfene Funktionen

| Funktion | Warum gestrichen |
|---|---|
| **Bodenrichtwerte** (Hamburg-Import u. a.) | Datenmenge und Import-Aufwand (CSV mit Geometrie-Daten, Node-Skript, riesige SQL-Dateien) standen in keinem Verhältnis zum Nutzen |
| **Häuserpreisindex** (Destatis/GENESIS-API) | API-Zugriff nie zuverlässig zum Laufen gebracht (Umstellung auf reine POST-Methoden, ungeklärte 405-Fehler trotz korrektem Aufbau) |
| **Bundesland-abhängige Grunderwerbsteuer** | Ersetzt durch einfachen Kaufnebenkosten-Regler (5–15 %) – weniger fehleranfällig, keine Pflege einer 16-Länder-Tabelle nötig |
| **Objekte als eigene Listen-Ansicht mit Löschen-Button** | Zugunsten von Papierkorb-Icon direkt im Rechner-Formular vereinfacht |
| **Tavily-Websuche für die KI** | Bewusst nicht eingebaut: kein Ortsbezug mehr in den Daten (macht Suche kaum spezifischer als die festen Richtwerte), Risiko uneinheitlicher Ergebnisse zwischen Anfragen, zusätzliche externe Abhängigkeit ohne klaren Mehrwert |
| **Mehrere KI-Modelle** | Cloudflare `llama-3.1-8b-instruct` (abgekündigt), Cloudflare `gemma-4-26b-a4b-it` (Reasoning-Modell, lieferte leeren Text), Groq `llama-3.3-70b-versatile` (abgekündigt), Cloudflare `llama-3.3-70b-instruct-fp8-fast` (zu langsam), Cloudflare `glm-4.7-flash` (trotz Namens ein Reasoning-Modell, lieferte trotz langer Wartezeit keinen Text) |

---

## Aktueller Stand / offene Punkte

- **KI-Modell-Tuning läuft noch:** Aktuell im Test ist `@cf/meta/llama-3.1-8b-instruct-fast` mit verbessertem Prompt (Ziel: kurze, aber inhaltlich starke Sätze bei akzeptabler Geschwindigkeit). Ob das die richtige Balance aus Tempo und Qualität trifft, ist zum Zeitpunkt dieses READMEs noch nicht final bestätigt.
- **Diagnose-Fallback ist noch aktiv:** In `handlers/rendite.ts` gibt die KI-Textzuweisung im Fehlerfall aktuell `JSON.stringify(aiResponse)` statt eines festen Textes zurück – nützlich zum Debuggen, sollte aber durch eine saubere Fehlermeldung ersetzt werden, sobald das Modell final feststeht.
- **`npx wrangler types` schlägt auf einem der beiden genutzten Laptops zuverlässig fehl** ("write EOF") – Ursache ungeklärt (Verdacht: OneDrive-Sync oder Antivirus im Projektordner). Workaround aktiv: `@cloudflare/workers-types` fest in der `tsconfig.json` eingetragen statt der automatisch generierten Typen.
- **Git/GitHub eingerichtet:** Repo unter `drqf87866-pixel/immo-calc`. Der Worker ist im Cloudflare-Dashboard per **Workers Builds** mit dem Repo verknüpft – jeder Push auf `main` löst automatisch Build + Deploy aus (Settings → Builds im Dashboard).

---

## Projektstruktur

```
immo-calc/
├── wrangler.jsonc              # Worker-Konfiguration (Name, D1-Binding, AI-Binding)
├── src/
│   ├── index.ts                 # Routing
│   ├── types.ts                 # Env-Interface, CORS-Header
│   ├── rendite.ts                # Reine Berechnungslogik (berechneRendite)
│   └── handlers/
│       ├── objekte.ts            # Objekte anlegen/bearbeiten/löschen/auflisten
│       ├── rendite.ts             # Rendite berechnen, speichern, KI-Einschätzung holen
│       └── kalkulationen.ts       # Verlauf auflisten/abrufen/löschen
└── frontend/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Datenmodell (D1)

- **`objekte`**: `id`, `bezeichnung`, `kaufpreis`, `wohnflaeche_qm`, `miete_kalt_monatlich`, `gast_id`, `erstellt_am`
- **`kalkulationen`**: `id`, `objekt_id`, Finanzierungs-Eingaben (Eigenkapital, Zinssatz, Tilgungssatz, Kaufnebenkosten-/AfA-/Gebäudeanteil-/Steuersatz-Prozent), berechnete Kennzahlen, `erstellt_am`
- **`ki_einschaetzungen`**: `id`, `kalkulation_id`, `text`, `erstellt_am`

Kalkulationen speichern nur die *Eingaben*, nicht die berechneten Detail-Werte (Cashflow-/GuV-Aufschlüsselung) – diese werden beim Abruf über `berechneRendite()` deterministisch neu erzeugt.
