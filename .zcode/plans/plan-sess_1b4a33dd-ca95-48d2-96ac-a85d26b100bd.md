# Mobile-UI-Optimierung Immo-Calc

## Phase-1-Fazit (bestätigt)
Vanilla Frontend aus genau 3 Dateien in `frontend/` (kein Framework, kein Build-Step), Worker-API + D1 im Backend. Ziel aller Änderungen: nur die 3 Frontend-Dateien; Geschäftslogik/Berechnungen/API bleiben unangetastet. Integrationstests prüfen nur Titel „Immo-Calc" und nicht-leeres app.js – brechen nicht.

Bestätigte Zusatzumfänge: **eigene Dialoge & Toasts**, **Hash-Routing für System-Zurück**, **aufklappbare Karten** in der Vergleichsansicht.

---

## Schritt 1: `frontend/styles.css` — Mobile-Grundlagen
1. **iOS-Zoom-Fix:** `input, select { font-size: 0.88rem }` → `1rem` (16px), Padding leicht erhöht (Touch).
2. **Touch-Targets ≥44px:** Basisbutton Mindesthöhe ~46px; `.btn-klein` von ~24px auf ≥44px hoch (Padding statt Fontsize vergrößern); `.btn-loeschen-icon` 38×38 → 44×44; Checkbox im Verlauf auf ~20px vergrößern; range-Slider etwas höhere Touch-Fläche.
3. **Container-Padding:** Media Query ≤640px — `.kopf`/`.seiten-grid` seitlich 2rem → 1rem, Kopf-Ober-Padding reduzieren.
4. **Formular-Layout mobil:** `.param-zeile` in Media Query ≤640px zu einspaltigem Grid (`display:grid; gap`) statt unkontrolliertem flex-wrap (Inline-`flex:`-Styles sind in Grid-Kontext wirkungslos; Desktop bleibt exakt wie heute).
5. **Overflow-Schutz:** `.objekt-auswahl-zeile select { min-width:0 }`, Zeile darf umbrechen; `.abschnitt .zeile` bekommt `gap` + rechte Werte `white-space:nowrap`, damit lange Labels (z. B. „AfA (2% …)") Werte nie überlappen; `overflow-wrap` für lange Objektnamen im Verlauf.
6. **Lesbarkeit mobil:** kleinste Fontgrößen anheben (kachel-label 0.65→0.7rem, liste sub 0.72→0.78rem o. ä.) nur im Breakpoint.
7. **Neue Komponenten:** Styles für `.kopf-aktionen` (Header-Buttonzeile, umschließbar), definierte `.btn-text` (ruhiger Sekundär-Stil — Klasse existiert heute undefiniert!), eigene Dialoge (`<dialog>` mit Backdrop), Toasts (unten mittig, animiert, `prefers-reduced-motion` beachten), `details.abschnitt > summary` (Marker weg, Chevron, Kopfwert rechts). Optional `safe-area-inset` + `theme-color`.

## Schritt 2: `frontend/index.html`
1. Meta: `viewport-fit=cover` ergänzen, `<meta name="theme-color">`.
2. Header: Inline-Style-Div → `.kopf-aktionen`; die zwei `.btn-text`-Buttons behalten Funktionalität (`zeigeGastCode`/`setzeGastCode` unverändert als Einstiegspunkte).
3. Prozent-Felder (Zinssatz, Tilgungssatz, Gebäudeanteil, Steuersatz): `type="number"` → `type="text" inputmode="decimal"`. Behebt neben Spinner-Pfeilen einen echten Bug: Bei `type=number` macht ein deutsches Komma („1,5") das Feld still leer → aktuell wird 0 % gespeichert. Parsing-Behandlung in Schritt 3.

## Schritt 3: `frontend/app.js`
1. **Dezimal-Parsing:** Neuer Helper `prozentAusEingabe(input)` (Komma→Punkt) für die 4 Prozent-Textfelder beim Submit (Zeilen 479–484). Geldfelder/Range-Werte bleiben unverändert.
2. **Eigenes Dialog-/Toast-Mini-Framework** (native `<dialog>`-Elemente + Promise-basierte Helfer):
   - `zeigeBestaetigung(titel, text) → Promise<boolean>` — ersetzt beide `confirm()` (Objekt löschen Z.176, Eintrag löschen Z.285).
   - `zeigeEingabeDialog(titel, hinweis, startwert) → Promise<string|null>` — ersetzt beide `prompt()` für Zugangscode; `zeigeGastCode()` zeigt Code zusätzlich mit **Kopieren-Button** (Clipboard-API + Toast „Kopiert"), gleiche Funktionsnamen/Onclicks.
   - `zeigeToast(text, typ)` — ersetzt beide `alert()` (Max-3-Hinweis Z.295, API-Fehler Z.493) und ergänzt Toast beim bisher stummen Fehler-Abbruch in `zeigeKalkulation` (Z.318).
3. **Hash-Routing (minimal):** `zeigeAnsicht()` pusht bei `ergebnis`/`vergleich` via `history.pushState` den Hash; `popstate`-Listener schaltet zurück auf die Hauptansicht; „← Zurück"-Buttons nutzen `history.back()` wo möglich. Deep-Link mit unbekanntem State fällt sicher auf Hauptansicht zurück (Ergebnisdaten sind ohne ID nicht wiederherstellbar).
4. **Aufklappbare Abschnitte:** `renderCashflowAbschnitt`/`renderGuvAbschnitt` → `<details class="abschnitt" open><summary>Cashflow-Sicht … <span class="kopfwert">±47 €</span></summary>…</details>` (GuV-Summenwert analog). Standardmäßig offen (= Desktop sieht fast gleich aus), auf dem Phone lassen sich Blöcke einklappen – Kernkennzahl bleibt als Vergleichswert in der Überschrift sichtbar. Betrifft automatisch Ergebnis- UND Vergleichsansicht (gemeinsam genutzte Funktionen).

## Schritt 4: Verifikation
1. `npm test` (Vitest/Workers) muss grün bleiben; `npx tsc --noEmit` ebenfalls.
2. Smoke-Test mit `nwrangler dev` → App im Browser öffnen und bei ~360px Breite prüfen: kein horizontaler Scroll, Formular einspaltig, Dialoge/Toasts funktional, Berechnen/Löschen/Vergleich läuft unverändert durch.

Keine Commits (außer auf Wunsch); alle Änderungen reviewbar in den 3 Dateien.