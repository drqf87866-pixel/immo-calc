const API_BASE = "";

// --- Gast-ID: pro Browser automatisch erzeugt, trennt die Daten ohne Login ---
function holeOderErzeugeGastId() {
  let id = localStorage.getItem("gastId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gastId", id);
  }
  return id;
}
const GAST_ID = holeOderErzeugeGastId();

function apiFetch(pfad, optionen = {}) {
  const headers = { ...(optionen.headers || {}), "X-Gast-Id": GAST_ID };
  return fetch(API_BASE + pfad, { ...optionen, headers });
}

// --- Escape-Hilfe fuer nutzerdefinierte Bezeichnungen in Template-Strings ---
function escapceText(text) {
  return String(text ?? "").replace(/[&<>"']/g, z => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]
  ));
}

// --- Toast-Meldungen unten mittig (Erstaz fuer alert) ---
let toastBereich = null;
function zeigeToast(text, typ = "info") {
  if (!toastBereich) {
    toastBereich = document.createElement("div");
    toastBereich.className = "toast-bereich";
    toastBereich.setAttribute("role", "status");
    document.body.appendChild(toastBereich);
  }
  const toast = document.createElement("div");
  toast.className = "toast" + (typ === "fehler" ? " toast-fehler" : "");
  toast.textContent = text;
  toastBereich.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-weg");
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// --- Eigene Dialoge auf <dialog>-Basis (Erstaz fuer confirm/prompt) ---
function baueDialog() {
  const dlg = document.createElement("dialog");
  dlg.className = "dialog";
  document.body.appendChild(dlg);
  return dlg;
}

function zeigeBestaetigung(titel, text, bestaetigenLabel = "Löschen") {
  return new Promise(resolve => {
    const dlg = baueDialog();
    dlg.innerHTML = `
      <h2 class="dialog-titel"></h2>
      <p class="dialog-text"></p>
      <div class="dialog-aktionen">
        <button type="button" class="btn-sekundaer js-abbrechen">Abbrechen</button>
        <button type="button" class="js-bestaetigen"></button>
      </div>
    `;
    // Nutzertexte bewusst via textContent statt innerHTML (XSS-sicher)
    dlg.querySelector(".dialog-titel").textContent = titel;
    dlg.querySelector(".dialog-text").textContent = text;
    dlg.querySelector(".js-bestaetigen").textContent = bestaetigenLabel;

    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "ja");
      dlg.remove();
    }, { once: true });
    dlg.querySelector(".js-abbrechen").addEventListener("click", () => dlg.close());
    dlg.querySelector(".js-bestaetigen").addEventListener("click", () => dlg.close("ja"));
    dlg.showModal();
  });
}

function zeigeEingabeDialog(titel, hinweis, startwert = "") {
  return new Promise(resolve => {
    const dlg = baueDialog();
    dlg.innerHTML = `
      <h2 class="dialog-titel"></h2>
      <p class="dialog-text"></p>
      <label class="dialog-eingabe-label">Zugangscode
        <input type="text" class="dialog-code-input" autocomplete="off" spellcheck="false" maxlength="64" />
      </label>
      <div class="dialog-aktionen">
        <button type="button" class="btn-sekundaer js-abbrechen">Abbrechen</button>
        <button type="button" class="js-uebernehmen">Übernehmen</button>
      </div>
    `;
    dlg.querySelector(".dialog-titel").textContent = titel;
    dlg.querySelector(".dialog-text").textContent = hinweis;
    const feld = dlg.querySelector("input");
    feld.value = startwert;

    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "ok" ? feld.value.trim() : null);
      dlg.remove();
    }, { once: true });
    dlg.querySelector(".js-abbrechen").addEventListener("click", () => dlg.close());
    dlg.querySelector(".js-uebernehmen").addEventListener("click", () => dlg.close("ok"));
    feld.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); dlg.close("ok"); }
    });
    dlg.showModal();
    feld.focus();
  });
}

function zeigeGastCode() {
  const dlg = baueDialog();
  dlg.innerHTML = `
    <h2 class="dialog-titel">Dein Zugangscode</h2>
    <p class="dialog-text">Mit diesem Code lädst du deine Daten auf einem anderen Gerät oder in einem anderen Browser.</p>
    <label class="dialog-eingabe-label">Code
      <input type="text" class="dialog-code-input num" readonly />
    </label>
    <div class="dialog-aktionen">
      <button type="button" class="btn-sekundaer js-kopieren">Kopieren</button>
      <button type="button" class="js-schliessen">Schließen</button>
    </div>
  `;
  const feld = dlg.querySelector("input");
  feld.value = GAST_ID;
  feld.addEventListener("focus", () => feld.select());

  dlg.addEventListener("close", () => { dlg.remove(); }, { once: true });
  dlg.querySelector(".js-schliessen").addEventListener("click", () => dlg.close());
  dlg.querySelector(".js-kopieren").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(GAST_ID);
      zeigeToast("Zugangscode kopiert.");
    } catch {
      feld.focus();
      zeigeToast("Kopieren nicht möglich – Code ist markiert, bitte manuell kopieren.", "fehler");
    }
  });
  dlg.showModal();
  feld.focus();
}

async function setzeGastCode() {
  const neu = await zeigeEingabeDialog(
    "Anderen Zugangscode verwenden",
    "Gib einen bestehenden Code ein, um deine Daten auf diesem Gerät oder Browser zu laden.",
    GAST_ID
  );
  if (neu) {
    localStorage.setItem("gastId", neu);
    location.reload();
  }
}

let objekteCache = [];
let verlaufCache = [];
let ausgewaehlteIds = [];
let aktiverVerlaufFilter = null;
let formModus = "neu"; // "neu" | "objekt" | "bearbeitenObjekt"

function formatZahl(n) {
  if (n === null || n === undefined) return "-";
  return Math.round(n).toLocaleString("de-DE");
}
function formatQuote(n) {
  if (n === null || n === undefined) return "-";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDatum(iso) {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

// --- Live-Formatierung mit Tausenderpunkt ---
function formatiereEingabeMitTrennzeichen(input) {
  input.addEventListener("input", () => {
    const cursorVonRechts = input.value.length - input.selectionStart;
    const rohwert = input.value.replace(/\D/g, "");
    const formatiert = rohwert ? Number(rohwert).toLocaleString("de-DE") : "";
    input.value = formatiert;
    const neuePosition = Math.max(0, formatiert.length - cursorVonRechts);
    input.setSelectionRange(neuePosition, neuePosition);
  });
}
function zahlAusEingabe(input) {
  return Number(input.value.replace(/\D/g, "")) || 0;
}
// Prozent-Eingaben: Komma (deutsche Tastatur) -> Punkt, leere/ungueltige Werte -> 0,
// min/max-Attribute aus dem HTML wirken als Clamp-Grenzen
function prozentAusEingabe(input) {
  let wert = Number(String(input.value).replace(",", ".").trim());
  if (!isFinite(wert)) wert = 0;
  const min = parseFloat(input.getAttribute("min"));
  const max = parseFloat(input.getAttribute("max"));
  if (!isNaN(min) && wert < min) wert = min;
  if (!isNaN(max) && wert > max) wert = max;
  return wert;
}
function setzeFormatierteZahl(input, wert) {
  input.value = wert || wert === 0 ? Number(wert).toLocaleString("de-DE") : "";
}

["objKaufpreis", "objWohnflaeche", "objKaltmiete", "eigenkapital"].forEach(id => {
  formatiereEingabeMitTrennzeichen(document.getElementById(id));
});

// --- Debounce-Hilfsfunktion (wird bisher nirgends im Projekt gebraucht) ---
function debounce(fn, wartezeitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wartezeitMs);
  };
}

// --- Reine Rechenlogik, 1:1 portiert aus src/rendite.ts (berechneRendite()) ---
// Quelle der Wahrheit bleibt src/rendite.ts; bei Aenderungen dort bitte hier nachziehen,
// da es ohne Build-Step kein gemeinsames Modul zwischen Worker und Frontend gibt.
function berechneIrrClient(cashflows) {
  const npv = rate => cashflows.reduce((summe, cf, t) => summe + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.99;
  let hi = 10;
  let npvLo = npv(lo);
  const npvHi = npv(hi);
  if (!isFinite(npvLo) || !isFinite(npvHi) || npvLo * npvHi > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 0.01) return mid;
    if ((npvLo < 0) === (npvMid < 0)) { lo = mid; npvLo = npvMid; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

function berechnePrognoseClient(input, basis) {
  const round0 = n => Math.round(n);
  const round2 = n => Math.round(n * 100) / 100;

  const wertsteigerungProzent = input.wertsteigerung_prozent ?? 2;
  const mietsteigerungProzent = input.mietsteigerung_prozent ?? 1.5;
  const haltedauerJahre = Math.max(1, Math.round(input.haltedauer_jahre ?? 10));
  const verkaufskostenProzent = input.verkaufskosten_prozent ?? 0;

  const annuitaetJahr = basis.darlehenssumme * ((input.zinssatz + input.tilgungssatz) / 100);

  let restschuld = basis.darlehenssumme;
  let kumulierteAfa = 0;
  let summeCashflowNachSteuern = 0;
  const jahre = [];

  for (let jahr = 1; jahr <= haltedauerJahre; jahr++) {
    const zinsJahr = restschuld * (input.zinssatz / 100);
    let tilgungJahr = annuitaetJahr - zinsJahr;
    if (tilgungJahr > restschuld) tilgungJahr = restschuld;
    if (tilgungJahr < 0) tilgungJahr = 0;

    const mieteJahr = basis.jahreskaltmiete * Math.pow(1 + mietsteigerungProzent / 100, jahr - 1);
    const bewirtschaftungskostenJahr = mieteJahr * (basis.bewirtschaftungskostenProzent / 100);
    const cashflowJahr = mieteJahr - bewirtschaftungskostenJahr - (zinsJahr + tilgungJahr);

    kumulierteAfa += basis.afaJahr;
    const steuerlicherGewinnJahr = mieteJahr - bewirtschaftungskostenJahr - zinsJahr - basis.afaJahr;
    const steuerJahr = steuerlicherGewinnJahr * (basis.steuersatzProzent / 100);
    const cashflowNachSteuernJahr = cashflowJahr - steuerJahr;
    summeCashflowNachSteuern += cashflowNachSteuernJahr;

    const immobilienwert = input.kaufpreis * Math.pow(1 + wertsteigerungProzent / 100, jahr);
    restschuld = Math.max(0, restschuld - tilgungJahr);

    jahre.push({
      jahr,
      restschuld: round0(restschuld),
      zins_jahr: round0(zinsJahr),
      tilgung_jahr: round0(tilgungJahr),
      miete_jahr: round0(mieteJahr),
      bewirtschaftungskosten_jahr: round0(bewirtschaftungskostenJahr),
      cashflow_jahr: round0(cashflowJahr),
      afa_jahr: round0(basis.afaJahr),
      steuerlicher_gewinn_jahr: round0(steuerlicherGewinnJahr),
      steuer_jahr: round0(steuerJahr),
      cashflow_nach_steuern_jahr: round0(cashflowNachSteuernJahr),
      immobilienwert: round0(immobilienwert),
    });
  }

  const letztesJahr = jahre[jahre.length - 1];
  const verkaufspreis = letztesJahr.immobilienwert;
  const verkaufskosten = verkaufspreis * (verkaufskostenProzent / 100);
  const restschuldBeiVerkauf = letztesJahr.restschuld;

  const restbuchwert = Math.max(0, basis.gesamtinvestition - kumulierteAfa);
  const veraeusserungsgewinn = verkaufspreis - verkaufskosten - restbuchwert;

  const spekulationssteuerPflichtig = haltedauerJahre < 10 && veraeusserungsgewinn > 0;
  const spekulationssteuer = spekulationssteuerPflichtig ? veraeusserungsgewinn * (basis.steuersatzProzent / 100) : 0;

  const nettoerloes = verkaufspreis - verkaufskosten - restschuldBeiVerkauf - spekulationssteuer;
  const gesamtrueckfluss = summeCashflowNachSteuern + nettoerloes;

  const cashflowReihe = [-input.eigenkapital, ...jahre.map((j, i) => {
    const istVerkaufsjahr = i === jahre.length - 1;
    return j.cashflow_nach_steuern_jahr + (istVerkaufsjahr ? nettoerloes : 0);
  })];
  const irr = input.eigenkapital > 0 ? berechneIrrClient(cashflowReihe) : null;

  return {
    wertsteigerung_prozent: wertsteigerungProzent,
    mietsteigerung_prozent: mietsteigerungProzent,
    haltedauer_jahre: haltedauerJahre,
    verkaufskosten_prozent: verkaufskostenProzent,
    jahre,
    verkauf: {
      verkaufspreis: round0(verkaufspreis),
      verkaufskosten: round0(verkaufskosten),
      restschuld: round0(restschuldBeiVerkauf),
      restbuchwert: round0(restbuchwert),
      veraeusserungsgewinn: round0(veraeusserungsgewinn),
      spekulationssteuer_pflichtig: spekulationssteuerPflichtig,
      spekulationssteuer: round0(spekulationssteuer),
      nettoerloes: round0(nettoerloes),
    },
    gesamtrendite: {
      summe_cashflow_nach_steuern: round0(summeCashflowNachSteuern),
      gesamtrueckfluss: round0(gesamtrueckfluss),
      kapitalrueckfluss_faktor: input.eigenkapital > 0 ? round2(gesamtrueckfluss / input.eigenkapital) : null,
      irr_prozent: irr !== null ? round2(irr * 100) : null,
    },
  };
}

function berechneRenditeClient(input) {
  const round0 = n => Math.round(n);
  const round2 = n => Math.round(n * 100) / 100;

  const kaufnebenkostenProzent = input.kaufnebenkosten_prozent ?? 10;
  const afaProzent = input.afa_prozent ?? 2;
  const gebaeudeanteilProzent = input.gebaeudeanteil_prozent ?? 80;
  const steuersatzProzent = input.steuersatz_prozent ?? 0;
  const bewirtschaftungskostenProzent = input.bewirtschaftungskosten_prozent ?? 20;

  const kaufnebenkosten = input.kaufpreis * (kaufnebenkostenProzent / 100);
  const gesamtinvestition = input.kaufpreis + kaufnebenkosten;

  const jahreskaltmiete = input.miete_kalt_monatlich * 12;
  const bewirtschaftungskostenJahr = jahreskaltmiete * (bewirtschaftungskostenProzent / 100);
  const nettobetriebsertragJahr = jahreskaltmiete - bewirtschaftungskostenJahr;

  const bruttomietrendite = (jahreskaltmiete / input.kaufpreis) * 100;
  const nettomietrendite = (nettobetriebsertragJahr / gesamtinvestition) * 100;
  const kaufpreisfaktor = input.kaufpreis / jahreskaltmiete;

  const kaufpreisProQm =
    input.wohnflaeche_qm && input.wohnflaeche_qm > 0
      ? input.kaufpreis / input.wohnflaeche_qm
      : null;

  const darlehenssumme = gesamtinvestition - input.eigenkapital;
  const zinsenJahr = darlehenssumme * (input.zinssatz / 100);
  const tilgungJahr = darlehenssumme * (input.tilgungssatz / 100);
  const kapitaldienstJahr = zinsenJahr + tilgungJahr;
  const cashflowJahr = nettobetriebsertragJahr - kapitaldienstJahr;

  const kapitaldienstdeckungsgrad = kapitaldienstJahr > 0 ? nettobetriebsertragJahr / kapitaldienstJahr : null;

  const eigenkapitalrendite =
    input.eigenkapital > 0 ? (cashflowJahr / input.eigenkapital) * 100 : null;

  const afaBemessungsgrundlage = gesamtinvestition * (gebaeudeanteilProzent / 100);
  const afaJahr = afaBemessungsgrundlage * (afaProzent / 100);
  const steuerlicherGewinnJahr = nettobetriebsertragJahr - zinsenJahr - afaJahr;
  const steuerJahr = steuerlicherGewinnJahr * (steuersatzProzent / 100);
  const cashflowNachSteuernJahr = cashflowJahr - steuerJahr;

  const eigenkapitalrenditeNachSteuern =
    input.eigenkapital > 0 ? (cashflowNachSteuernJahr / input.eigenkapital) * 100 : null;

  const prognose = berechnePrognoseClient(input, {
    darlehenssumme,
    jahreskaltmiete,
    bewirtschaftungskostenProzent,
    afaJahr,
    steuersatzProzent,
    gesamtinvestition,
  });

  return {
    kaufnebenkosten: round0(kaufnebenkosten),
    kaufnebenkosten_prozent: kaufnebenkostenProzent,
    gesamtinvestition: round0(gesamtinvestition),
    bruttomietrendite: round2(bruttomietrendite),
    nettomietrendite: round2(nettomietrendite),
    kaufpreisfaktor: round2(kaufpreisfaktor),
    kapitaldienstdeckungsgrad: kapitaldienstdeckungsgrad !== null ? round2(kapitaldienstdeckungsgrad) : null,
    kaufpreis_pro_qm: kaufpreisProQm !== null ? round0(kaufpreisProQm) : null,
    darlehenssumme: round0(darlehenssumme),
    eigenkapitalrendite: eigenkapitalrendite !== null ? round2(eigenkapitalrendite) : null,
    cashflow: {
      miete_monatlich: round0(input.miete_kalt_monatlich),
      bewirtschaftungskosten_monatlich: round0(bewirtschaftungskostenJahr / 12),
      zins_monatlich: round0(zinsenJahr / 12),
      tilgung_monatlich: round0(tilgungJahr / 12),
      cashflow_monatlich: round0(cashflowJahr / 12),
    },
    guv: {
      miete_jahr: round0(jahreskaltmiete),
      bewirtschaftungskosten_jahr: round0(bewirtschaftungskostenJahr),
      bewirtschaftungskosten_prozent: bewirtschaftungskostenProzent,
      zinsen_jahr: round0(zinsenJahr),
      afa_jahr: round0(afaJahr),
      afa_prozent: afaProzent,
      gebaeudeanteil_prozent: gebaeudeanteilProzent,
      steuerlicher_gewinn_jahr: round0(steuerlicherGewinnJahr),
      steuersatz_prozent: steuersatzProzent,
      steuer_jahr: round0(steuerJahr),
      cashflow_nach_steuern_monatlich: round0(cashflowNachSteuernJahr / 12),
      eigenkapitalrendite_nach_steuern:
        eigenkapitalrenditeNachSteuern !== null ? round2(eigenkapitalrenditeNachSteuern) : null,
    },
    prognose,
  };
}

// Reihenfolge der Kennzahlen, die als Kachel erscheinen (ohne eigenen KI-Text je Kachel,
// die Einordnung erfolgt gesammelt in der Gesamteinschätzung darunter).
const KACHEL_METRIKEN = [
  { label: "Kaufpreisfaktor", gerichtet: false,
    wert: e => formatQuote(e.kaufpreisfaktor), roh: e => e.kaufpreisfaktor },
  { label: "Kapitaldienstdeckungsgrad", gerichtet: true, schwelle: 1,
    wert: e => formatQuote(e.kapitaldienstdeckungsgrad), roh: e => e.kapitaldienstdeckungsgrad },
  { label: "Bruttomietrendite", gerichtet: false,
    wert: e => formatQuote(e.bruttomietrendite) + " %", roh: e => e.bruttomietrendite },
  { label: "Nettomietrendite", gerichtet: false,
    wert: e => formatQuote(e.nettomietrendite) + " %", roh: e => e.nettomietrendite },
  { label: "Cashflow vor Steuern", gerichtet: true, schwelle: 0,
    wert: e => formatZahl(e.cashflow.cashflow_monatlich) + " €", roh: e => e.cashflow.cashflow_monatlich },
  { label: "Cashflow nach Steuern", gerichtet: true, schwelle: 0,
    wert: e => formatZahl(e.guv.cashflow_nach_steuern_monatlich) + " €", roh: e => e.guv.cashflow_nach_steuern_monatlich },
  { label: "Eigenkapitalrendite", gerichtet: true, schwelle: 0,
    wert: e => formatQuote(e.eigenkapitalrendite) + " %", roh: e => e.eigenkapitalrendite },
  { label: "Eigenkapitalrendite nach Steuern", gerichtet: true, schwelle: 0,
    wert: e => formatQuote(e.guv.eigenkapitalrendite_nach_steuern) + " %", roh: e => e.guv.eigenkapitalrendite_nach_steuern },
  { label: "Gesamtrendite (IRR)", gerichtet: true, schwelle: 0,
    wert: e => e.prognose.gesamtrendite.irr_prozent !== null ? formatQuote(e.prognose.gesamtrendite.irr_prozent) + " %" : "-",
    roh: e => e.prognose.gesamtrendite.irr_prozent },
];

function renderKennzahlKacheln(ergebnis) {
  return KACHEL_METRIKEN.map(m => {
    const roh = m.roh(ergebnis);
    let farbKlasse = "";
    if (m.gerichtet && roh !== null && roh !== undefined) {
      farbKlasse = roh < m.schwelle ? "negativ" : "positiv";
    }

    return `
      <div class="kachel">
        <div class="kachel-label">${m.label}</div>
        <div class="kachel-wert num ${farbKlasse}">${m.wert(ergebnis)}</div>
      </div>
    `;
  }).join("");
}

// --- Live-Vorschau im Rechner: reine Zahlen-Kacheln ohne Speichern/KI-Aufruf ---
function aktualisiereLiveVorschau() {
  const panel = document.getElementById("liveVorschauKacheln");
  if (!panel) return;
  const leerHinweis = document.getElementById("liveVorschauLeer");
  const kiHinweis = document.getElementById("liveVorschauHinweis");

  const kaufpreis = zahlAusEingabe(document.getElementById("objKaufpreis"));
  const kaltmiete = zahlAusEingabe(document.getElementById("objKaltmiete"));

  if (!kaufpreis || !kaltmiete) {
    panel.innerHTML = "";
    leerHinweis.hidden = false;
    kiHinweis.hidden = true;
    return;
  }
  leerHinweis.hidden = true;
  kiHinweis.hidden = false;

  const input = {
    kaufpreis,
    miete_kalt_monatlich: kaltmiete,
    eigenkapital: zahlAusEingabe(document.getElementById("eigenkapital")),
    zinssatz: prozentAusEingabe(document.getElementById("zinssatz")),
    tilgungssatz: prozentAusEingabe(document.getElementById("tilgungssatz")),
    wohnflaeche_qm: zahlAusEingabe(document.getElementById("objWohnflaeche")) || undefined,
    kaufnebenkosten_prozent: Number(document.getElementById("kaufnebenkosten").value),
    afa_prozent: Number(document.getElementById("afa").value),
    gebaeudeanteil_prozent: prozentAusEingabe(document.getElementById("gebaeudeanteil")),
    steuersatz_prozent: prozentAusEingabe(document.getElementById("steuersatz")),
    bewirtschaftungskosten_prozent: Number(document.getElementById("bewirtschaftungskosten").value),
    wertsteigerung_prozent: Number(document.getElementById("wertsteigerung").value),
    mietsteigerung_prozent: Number(document.getElementById("mietsteigerung").value),
    haltedauer_jahre: Number(document.getElementById("haltedauer").value),
    verkaufskosten_prozent: Number(document.getElementById("verkaufskosten").value),
  };

  panel.innerHTML = renderKennzahlKacheln(berechneRenditeClient(input));
}
const aktualisiereLiveVorschauDebounced = debounce(aktualisiereLiveVorschau, 200);

// Textfelder: Live-Vorschau bei jedem Tastendruck (entkoppelt), Regler: Anzeige + Vorschau sofort
["objKaufpreis", "objWohnflaeche", "objKaltmiete", "eigenkapital", "zinssatz", "tilgungssatz", "gebaeudeanteil", "steuersatz"].forEach(id => {
  document.getElementById(id).addEventListener("input", aktualisiereLiveVorschauDebounced);
});
function wireRegler(reglerId, wertSpanId) {
  const regler = document.getElementById(reglerId);
  const span = document.getElementById(wertSpanId);
  regler.addEventListener("input", () => {
    span.textContent = regler.value;
    aktualisiereLiveVorschauDebounced();
  });
}
wireRegler("kaufnebenkosten", "knkWert");
wireRegler("afa", "afaWert");
wireRegler("bewirtschaftungskosten", "bwkWert");
wireRegler("haltedauer", "haltedauerWert");
wireRegler("wertsteigerung", "wertsteigerungWert");
wireRegler("mietsteigerung", "mietsteigerungWert");
wireRegler("verkaufskosten", "verkaufskostenWert");

// --- Gesamteinschätzung: KI-Fließtext von Gemini ---
function renderGesamteinschaetzung(ergebnis) {
  if (!ergebnis.einschaetzung) return "";
  return `
    <div class="gesamteinschaetzung">
      <div class="gesamteinschaetzung-label">Gesamteinschätzung</div>
      <div class="gesamteinschaetzung-text">${ergebnis.einschaetzung}</div>
    </div>
  `;
}

// --- Eingabe-Box (Kaufpreis, Eigenkapital, Zinssatz, Tilgungssatz) ---
function renderEingabeBox(ergebnis) {
  return `
    <div class="eingabe-box num">
      <div class="zeile"><span>Kaufpreis</span><span>${formatZahl(ergebnis.kaufpreis)} €</span></div>
      <div class="zeile"><span>Eigenkapital</span><span>${formatZahl(ergebnis.eigenkapital)} €</span></div>
      <div class="zeile"><span>Zinssatz</span><span>${formatQuote(ergebnis.zinssatz)} %</span></div>
      <div class="zeile"><span>Tilgungssatz</span><span>${formatQuote(ergebnis.tilgungssatz)} %</span></div>
    </div>
  `;
}

// --- Formular-Modus-Steuerung ---
function setzeFormularModus(modus) {
  formModus = modus;
  const felder = [
    document.getElementById("objBezeichnung"),
    document.getElementById("objOrt"),
    document.getElementById("objKaufpreis"),
    document.getElementById("objWohnflaeche"),
    document.getElementById("objKaltmiete"),
  ];
  const submitBtn = document.getElementById("formSubmitBtn");
  const bearbeitenBtn = document.getElementById("bearbeitenToggleBtn");
  const loeschenBtn = document.getElementById("loeschenObjektBtn");
  const titel = document.getElementById("formTitel");

  if (modus === "neu") {
    felder.forEach(f => { f.readOnly = false; f.value = ""; });
    bearbeitenBtn.hidden = true;
    loeschenBtn.hidden = true;
    submitBtn.textContent = "Rendite berechnen";
    titel.textContent = "Rendite-Rechner";
  } else if (modus === "objekt") {
    felder.forEach(f => f.readOnly = true);
    bearbeitenBtn.hidden = false;
    loeschenBtn.hidden = false;
    submitBtn.textContent = "Rendite berechnen";
    titel.textContent = "Rendite-Rechner";
  } else if (modus === "bearbeitenObjekt") {
    felder.forEach(f => f.readOnly = false);
    bearbeitenBtn.hidden = true;
    loeschenBtn.hidden = true;
    submitBtn.textContent = "Objekt speichern";
    titel.textContent = "Objekt bearbeiten";
  }
  aktualisiereLiveVorschau();
}

function bearbeitenToggle() {
  setzeFormularModus("bearbeitenObjekt");
}

async function loescheAusgewaehltesObjekt() {
  const auswahlId = document.getElementById("objektAuswahl").value;
  if (!auswahlId || auswahlId === "neu") return;
  const objekt = objekteCache.find(o => String(o.id) === auswahlId);
  const bestaetigt = await zeigeBestaetigung(
    "Objekt löschen",
    `"${objekt?.bezeichnung ?? "Objekt"}" und alle zugehörigen Berechnungen wirklich löschen?`
  );
  if (!bestaetigt) return;

  await apiFetch("/api/objekte/" + auswahlId, { method: "DELETE" });

  if (aktiverVerlaufFilter === Number(auswahlId)) {
    aktiverVerlaufFilter = null;
  }

  document.getElementById("objektAuswahl").value = "neu";
  setzeFormularModus("neu");
  await ladeObjekte();
  await ladeVerlauf();
}

document.getElementById("objektAuswahl").addEventListener("change", (e) => {
  const wert = e.target.value;
  if (wert === "neu") {
    setzeFormularModus("neu");
    return;
  }
  const o = objekteCache.find(x => String(x.id) === wert);
  if (!o) return;
  document.getElementById("objBezeichnung").value = o.bezeichnung;
  document.getElementById("objOrt").value = o.ort ?? "";
  setzeFormatierteZahl(document.getElementById("objKaufpreis"), o.kaufpreis);
  setzeFormatierteZahl(document.getElementById("objWohnflaeche"), o.wohnflaeche_qm);
  setzeFormatierteZahl(document.getElementById("objKaltmiete"), o.miete_kalt_monatlich);
  setzeFormularModus("objekt");
});

// --- Objekte laden (füllt beide Dropdowns: Rechner + Verlauf-Filter) ---
async function ladeObjekte() {
  const res = await apiFetch("/api/objekte");
  objekteCache = await res.json();

  const auswahl = document.getElementById("objektAuswahl");
  const bisherigeAuswahl = auswahl.value;
  auswahl.innerHTML = `<option value="neu">+ Neues Objekt</option>`;
  objekteCache.forEach(o => {
    auswahl.innerHTML += `<option value="${o.id}">${escapceText(o.bezeichnung)}</option>`;
  });
  if ([...auswahl.options].some(opt => opt.value === bisherigeAuswahl)) {
    auswahl.value = bisherigeAuswahl;
  }

  renderVerlaufFilterChips();
}

// --- Verlauf-Filter als anklickbare Chips (ersetzt das fruehere <select>) ---
function renderVerlaufFilterChips() {
  const container = document.getElementById("verlaufFilterChips");
  // aktiverVerlaufFilter bezieht sich auf ein evtl. inzwischen geloeschtes Objekt:
  // in dem Fall stillschweigend auf "Alle Objekte" zuruecksetzen
  if (aktiverVerlaufFilter !== null && !objekteCache.some(o => o.id === aktiverVerlaufFilter)) {
    aktiverVerlaufFilter = null;
  }
  const chips = [{ id: null, label: "Alle Objekte" }, ...objekteCache.map(o => ({ id: o.id, label: o.bezeichnung }))];
  container.innerHTML = chips.map(c => `
    <button type="button" class="chip ${aktiverVerlaufFilter === c.id ? "aktiv" : ""}" data-filter-id="${c.id ?? ""}">${escapceText(c.label)}</button>
  `).join("");
  container.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const wert = btn.dataset.filterId;
      aktiverVerlaufFilter = wert ? Number(wert) : null;
      renderVerlaufFilterChips();
      renderVerlaufListe();
    });
  });
}

// --- Verlauf ---
async function ladeVerlauf() {
  const res = await apiFetch("/api/kalkulationen");
  verlaufCache = await res.json();
  renderVerlaufListe();
}

function renderVerlaufListe() {
  const liste = aktiverVerlaufFilter ? verlaufCache.filter(e => e.objekt_id === aktiverVerlaufFilter) : verlaufCache;

  const container = document.getElementById("verlaufListe");
  const leerHinweis = document.getElementById("verlaufLeer");
  container.innerHTML = "";

  if (liste.length === 0) {
    leerHinweis.hidden = false;
    document.getElementById("vergleichsleiste").hidden = true;
    return;
  }
  leerHinweis.hidden = true;

  liste.forEach(eintrag => {
    const negativ = eintrag.cashflow_nach_steuern_monatlich < 0;
    const angehakt = ausgewaehlteIds.includes(eintrag.id);
    const zeile = document.createElement("div");
    zeile.className = "liste-zeile";
    zeile.tabIndex = 0;
    zeile.innerHTML = `
      <div class="links">
        <input type="checkbox" ${angehakt ? "checked" : ""} onclick="event.stopPropagation(); toggleAuswahl(${eintrag.id}, this)" />
        <div>
          <div class="info">${escapceText(eintrag.objekt_bezeichnung ?? "Kalkulation")}</div>
          <div class="sub">${formatDatum(eintrag.erstellt_am)} · ${formatQuote(eintrag.bruttomietrendite)} % Brutto</div>
        </div>
      </div>
      <div class="rechts">
        <span class="cf num ${negativ ? "negativ" : "positiv"}">${formatZahl(eintrag.cashflow_nach_steuern_monatlich)} €</span>
        <button class="btn-klein" onclick="event.stopPropagation(); loescheEintrag(${eintrag.id})">Löschen</button>
      </div>
    `;
    zeile.addEventListener("click", () => zeigeKalkulation(eintrag.id));
    container.appendChild(zeile);
  });

  aktualisiereVergleichsleiste();
}

async function loescheEintrag(id) {
  const bestaetigt = await zeigeBestaetigung(
    "Eintrag löschen",
    "Diesen Eintrag wirklich aus dem Verlauf löschen?"
  );
  if (!bestaetigt) return;
  await apiFetch("/api/kalkulationen/" + id, { method: "DELETE" });
  ausgewaehlteIds = ausgewaehlteIds.filter(x => x !== id);
  ladeVerlauf();
}

function toggleAuswahl(id, checkbox) {
  if (checkbox.checked) {
    if (ausgewaehlteIds.length >= 3) {
      checkbox.checked = false;
      zeigeToast("Du kannst maximal 3 Berechnungen gleichzeitig vergleichen.");
      return;
    }
    ausgewaehlteIds.push(id);
  } else {
    ausgewaehlteIds = ausgewaehlteIds.filter(x => x !== id);
  }
  aktualisiereVergleichsleiste();
}

function aktualisiereVergleichsleiste() {
  const leiste = document.getElementById("vergleichsleiste");
  if (ausgewaehlteIds.length >= 2) {
    leiste.hidden = false;
    document.getElementById("vergleichsAnzahl").textContent = ausgewaehlteIds.length;
  } else {
    leiste.hidden = true;
  }
}

async function zeigeKalkulation(id) {
  const res = await apiFetch("/api/kalkulationen/" + id);
  const ergebnis = await res.json();
  if (ergebnis.error) { zeigeToast(ergebnis.error, "fehler"); return; }
  renderErgebnis(ergebnis);
  zeigeAnsicht("ergebnis");
}

async function zeigeVergleich() {
  const ergebnisse = await Promise.all(
    ausgewaehlteIds.map(id => apiFetch("/api/kalkulationen/" + id).then(r => r.json()))
  );
  renderVergleich(ergebnisse);
  zeigeAnsicht("vergleich");
}

// --- Ansicht-Umschaltung + minimales Hash-Routing ---
// Der System-Zurueck-Button (popstate) fuehrt aus der Ergebnis-/Vergleichsansicht
// zur vorherigen Ansicht zurueck, statt die App zu verlassen. Deep-Links (#ergebnis)
// koennen ohne geladene Inhalte nichts anzeigen und fallen sicher auf "rechner".
const ANSICHTEN = ["rechner", "verlauf", "ergebnis", "vergleich"];

function aktualisiereNavAktiv(name) {
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.toggle("aktiv", tab.dataset.ansicht === name);
  });
}

function schalteAnsicht(name) {
  document.getElementById("ansichtRechner").hidden = name !== "rechner";
  document.getElementById("ansichtVerlauf").hidden = name !== "verlauf";
  document.getElementById("ansichtErgebnis").hidden = name !== "ergebnis";
  document.getElementById("ansichtVergleich").hidden = name !== "vergleich";
  aktualisiereNavAktiv(name);
  if (name === "verlauf") { ausgewaehlteIds = []; ladeVerlauf(); }
  if (name === "rechner") { aktualisiereLiveVorschau(); }
}

function zeigeAnsicht(name) {
  const ziel = ANSICHTEN.includes(name) ? name : "rechner";
  schalteAnsicht(ziel);
  const zielHash = ziel === "rechner" ? "" : "#" + ziel;
  const bereitsImVerlauf = history.state?.ansicht === ziel &&
    location.hash === zielHash;
  if (!bereitsImVerlauf) {
    history.pushState({ ansicht: ziel }, "", zielHash || location.pathname + location.search);
  }
}

window.addEventListener("popstate", e => {
  const name = ANSICHTEN.includes(e.state?.ansicht) ? e.state.ansicht : "rechner";
  schalteAnsicht(name);
});

function zurueckZurHauptansicht() {
  // Sind wir per pushState in einer Unteransicht, konsumiert back() diesen Eintrag
  if (history.state?.ansicht) {
    history.back();
  } else {
    zeigeAnsicht("rechner");
  }
}
document.getElementById("zurueckButton").addEventListener("click", zurueckZurHauptansicht);
document.getElementById("zurueckButtonVergleich").addEventListener("click", zurueckZurHauptansicht);

// Alter Hash beim Start neutralisieren (z.B. Reload auf #ergebnis ohne Daten)
if (location.hash) {
  history.replaceState({ ansicht: "rechner" }, "", location.pathname + location.search);
}

// --- Cashflow-/GuV-Abschnitte (gemeinsam genutzt von Ergebnis- und Vergleichsseite) ---
// Statische Karten statt Klapp-Boxen: beide waren ohnehin immer offen und zeigten den
// Endwert zusaetzlich noch einmal im Header - das war die eigentliche Unuebersichtlichkeit,
// nicht das Klappen an sich. Der Wert steht jetzt nur noch einmal, in der Ergebniszeile.
function renderCashflowAbschnitt(ergebnis) {
  const cf = ergebnis.cashflow;
  const negCashflow = cf.cashflow_monatlich < 0;
  return `
    <div class="abschnitt">
      <div class="abschnitt-titel">Cashflow-Sicht (monatlich)</div>
      <div class="zeile"><span>Mieteinnahmen</span><span class="num">${formatZahl(cf.miete_monatlich)} €</span></div>
      <div class="zeile"><span>Bewirtschaftungskosten</span><span class="num">-${formatZahl(cf.bewirtschaftungskosten_monatlich)} €</span></div>
      <div class="zeile"><span>Zins</span><span class="num">-${formatZahl(cf.zins_monatlich)} €</span></div>
      <div class="zeile"><span>Tilgung</span><span class="num">-${formatZahl(cf.tilgung_monatlich)} €</span></div>
      <div class="zeile summe ${negCashflow ? "negativ" : "positiv"}"><span>Cashflow</span><span class="num">${formatZahl(cf.cashflow_monatlich)} €</span></div>
    </div>
  `;
}

function renderGuvAbschnitt(ergebnis) {
  const guv = ergebnis.guv;
  const negNachSteuer = guv.cashflow_nach_steuern_monatlich < 0;
  const negGewinn = guv.steuerlicher_gewinn_jahr < 0;
  const negEkrNachSteuer = guv.eigenkapitalrendite_nach_steuern < 0;
  const isErstattung = guv.steuer_jahr < 0;
  const steuerLabel = isErstattung ? "Steuererstattung" : "Steuerzahlung";
  const steuerVorzeichen = isErstattung ? "+" : "-";
  const steuerBetrag = formatZahl(Math.abs(guv.steuer_jahr));
  const steuerKlasse = isErstattung ? "positiv" : "negativ";

  return `
    <div class="abschnitt">
      <div class="abschnitt-titel">GuV-Sicht (steuerlich, pro Jahr)</div>
      <div class="zeile"><span>Mieteinnahmen</span><span class="num">${formatZahl(guv.miete_jahr)} €</span></div>
      <div class="zeile"><span>Bewirtschaftungskosten (${guv.bewirtschaftungskosten_prozent}%)</span><span class="num">-${formatZahl(guv.bewirtschaftungskosten_jahr)} €</span></div>
      <div class="zeile"><span>Zinsen</span><span class="num">-${formatZahl(guv.zinsen_jahr)} €</span></div>
      <div class="zeile"><span>AfA (${guv.afa_prozent}% auf ${guv.gebaeudeanteil_prozent}% Gebäudeanteil)</span><span class="num">-${formatZahl(guv.afa_jahr)} €</span></div>
      <div class="zeile summe ${negGewinn ? "negativ" : "positiv"}"><span>Steuerlicher Gewinn/Verlust</span><span class="num">${formatZahl(guv.steuerlicher_gewinn_jahr)} €</span></div>
      <div class="zeile"><span>${steuerLabel} (${guv.steuersatz_prozent}%)</span><span class="num ${steuerKlasse}">${steuerVorzeichen}${steuerBetrag} €</span></div>
      <div class="ergebnis-zeile ${negNachSteuer ? "negativ" : "positiv"}"><span>Cashflow nach Steuern (mtl.)</span><span class="num" data-metrik="cf-nach-steuern">${formatZahl(guv.cashflow_nach_steuern_monatlich)} €</span></div>
      <div class="ergebnis-zeile ${negEkrNachSteuer ? "negativ" : "positiv"}"><span>Eigenkapitalrendite nach Steuern</span><span class="num" data-metrik="ekr-nach-steuern">${formatQuote(guv.eigenkapitalrendite_nach_steuern)} %</span></div>
    </div>
  `;
}

// --- Mehrjahresprognose-Abschnitt: Verkaufsszenario + Gesamtrendite, optional mit Jahrestabelle ---
function renderPrognoseAbschnitt(ergebnis, kompakt = false) {
  const p = ergebnis.prognose;
  if (!p) return "";
  const negGewinn = p.verkauf.veraeusserungsgewinn < 0;
  const irrText = p.gesamtrendite.irr_prozent !== null ? formatQuote(p.gesamtrendite.irr_prozent) + " %" : "nicht ermittelbar (kein Eigenkapital eingesetzt)";
  const negIrr = p.gesamtrendite.irr_prozent !== null && p.gesamtrendite.irr_prozent < 0;

  const tabelle = kompakt ? "" : `
    <div class="prognose-tabelle-wrapper">
      <table class="prognose-tabelle num">
        <thead>
          <tr><th>Jahr</th><th>Restschuld</th><th>Miete/Jahr</th><th>Cashflow n. St.</th><th>Immobilienwert</th></tr>
        </thead>
        <tbody>
          ${p.jahre.map(j => `
            <tr>
              <td>${j.jahr}</td>
              <td>${formatZahl(j.restschuld)} €</td>
              <td>${formatZahl(j.miete_jahr)} €</td>
              <td class="${j.cashflow_nach_steuern_jahr < 0 ? "negativ" : ""}">${formatZahl(j.cashflow_nach_steuern_jahr)} €</td>
              <td>${formatZahl(j.immobilienwert)} €</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="abschnitt">
      <div class="abschnitt-titel">Mehrjahresprognose (${p.haltedauer_jahre} Jahre · ${p.wertsteigerung_prozent}% Wertsteigerung, ${p.mietsteigerung_prozent}% Mietsteigerung p.a.)</div>
      ${tabelle}
      <div class="zeile"><span>Verkaufspreis nach ${p.haltedauer_jahre} Jahren</span><span class="num">${formatZahl(p.verkauf.verkaufspreis)} €</span></div>
      <div class="zeile"><span>./. Restschuld</span><span class="num">-${formatZahl(p.verkauf.restschuld)} €</span></div>
      ${p.verkauf.verkaufskosten > 0 ? `<div class="zeile"><span>./. Verkaufskosten</span><span class="num">-${formatZahl(p.verkauf.verkaufskosten)} €</span></div>` : ""}
      <div class="zeile"><span>Veräußerungsgewinn</span><span class="num ${negGewinn ? "negativ" : "positiv"}">${formatZahl(p.verkauf.veraeusserungsgewinn)} €</span></div>
      <div class="zeile"><span>Spekulationssteuer${p.verkauf.spekulationssteuer_pflichtig ? "" : " (steuerfrei nach 10 Jahren)"}</span><span class="num">-${formatZahl(p.verkauf.spekulationssteuer)} €</span></div>
      <div class="zeile summe"><span>Nettoerlös aus Verkauf</span><span class="num">${formatZahl(p.verkauf.nettoerloes)} €</span></div>
      <div class="ergebnis-zeile ${negIrr ? "negativ" : "positiv"}"><span>Gesamtrendite (IRR, p.a.)</span><span class="num" data-metrik="irr">${irrText}</span></div>
    </div>
  `;
}

// --- Ergebnis rendern ---
function renderErgebnis(ergebnis) {
  const kaufpreisProQmZeile = ergebnis.kaufpreis_pro_qm !== null && ergebnis.kaufpreis_pro_qm !== undefined
    ? ` &nbsp;·&nbsp; Preis/m²: ${formatZahl(ergebnis.kaufpreis_pro_qm)} €`
    : "";

  document.getElementById("ergebnisInhalt").innerHTML = `
    <div class="verlauf-titel">${escapceText(ergebnis.objekt_bezeichnung ?? "Kalkulation")}</div>

    ${renderEingabeBox(ergebnis)}

    <p class="neben-info num">
      Kaufnebenkosten (${ergebnis.kaufnebenkosten_prozent}%): ${formatZahl(ergebnis.kaufnebenkosten)} € &nbsp;·&nbsp;
      Gesamtinvestition: ${formatZahl(ergebnis.gesamtinvestition)} €${kaufpreisProQmZeile}
    </p>

    <div class="kennzahl-kacheln">
      ${renderKennzahlKacheln(ergebnis)}
    </div>

    ${renderGesamteinschaetzung(ergebnis)}

    ${renderCashflowAbschnitt(ergebnis)}
    ${renderGuvAbschnitt(ergebnis)}
    ${renderPrognoseAbschnitt(ergebnis)}
  `;
}

// --- Vergleichsansicht ---
function renderVergleich(liste) {
  const spalten = liste.map(ergebnis => `
    <div class="vergleich-spalte">
      <div class="vergleich-titel">${escapceText(ergebnis.objekt_bezeichnung ?? "Kalkulation")}</div>
      <div class="vergleich-datum">${formatDatum(ergebnis.erstellt_am)}</div>

      ${renderEingabeBox(ergebnis)}

      <div class="kpi-leiste-klein">
        <div><div class="label">Brutto</div><div class="wert num" data-metrik="brutto">${formatQuote(ergebnis.bruttomietrendite)}%</div></div>
        <div><div class="label">KPF</div><div class="wert num">${formatQuote(ergebnis.kaufpreisfaktor)}</div></div>
        ${ergebnis.kaufpreis_pro_qm !== null ? `<div><div class="label">€/m²</div><div class="wert num">${formatZahl(ergebnis.kaufpreis_pro_qm)}</div></div>` : ""}
      </div>

      ${renderCashflowAbschnitt(ergebnis)}
      ${renderGuvAbschnitt(ergebnis)}
      ${renderPrognoseAbschnitt(ergebnis, true)}
    </div>
  `).join("");

  document.getElementById("vergleichInhalt").innerHTML = spalten;
  hebeVergleichsUnterschiedeHervor(liste);
}

// --- Beste/schlechteste Werte je Kennzahl ueber die verglichenen Objekte farblich hervorheben ---
function hebeVergleichsUnterschiedeHervor(liste) {
  if (liste.length < 2) return;
  const spalten = [...document.querySelectorAll("#vergleichInhalt .vergleich-spalte")];
  const metriken = [
    { attr: "brutto", wert: e => e.bruttomietrendite },
    { attr: "cf-nach-steuern", wert: e => e.guv?.cashflow_nach_steuern_monatlich },
    { attr: "ekr-nach-steuern", wert: e => e.guv?.eigenkapitalrendite_nach_steuern },
    { attr: "irr", wert: e => e.prognose?.gesamtrendite?.irr_prozent },
  ];
  metriken.forEach(m => {
    const werte = liste.map(m.wert);
    if (werte.some(w => w === null || w === undefined || !isFinite(w))) return;
    const maxWert = Math.max(...werte);
    const minWert = Math.min(...werte);
    if (maxWert === minWert) return; // alle Objekte gleichauf, nichts hervorzuheben
    spalten.forEach((spalte, i) => {
      const el = spalte.querySelector(`[data-metrik="${m.attr}"]`);
      if (!el) return;
      if (werte[i] === maxWert) el.classList.add("vergleich-bestwert");
      else if (werte[i] === minWert) el.classList.add("vergleich-schlechtwert");
    });
  });
}

// --- Formular-Submit ---
document.getElementById("renditeForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("formSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.setAttribute("aria-busy", "true");
  submitBtn.classList.add("btn-laedt");

  try {
    if (formModus === "bearbeitenObjekt") {
      const auswahlId = document.getElementById("objektAuswahl").value;
      const input = {
        bezeichnung: document.getElementById("objBezeichnung").value,
        ort: document.getElementById("objOrt").value || undefined,
        kaufpreis: zahlAusEingabe(document.getElementById("objKaufpreis")),
        wohnflaeche_qm: zahlAusEingabe(document.getElementById("objWohnflaeche")) || undefined,
        miete_kalt_monatlich: zahlAusEingabe(document.getElementById("objKaltmiete")),
      };
      await apiFetch("/api/objekte/" + auswahlId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await ladeObjekte();
      document.getElementById("objektAuswahl").value = auswahlId;
      document.getElementById("objektAuswahl").dispatchEvent(new Event("change"));
      await ladeVerlauf();
      return;
    }

    let objektId;
    if (formModus === "neu") {
      const input = {
        bezeichnung: document.getElementById("objBezeichnung").value,
        ort: document.getElementById("objOrt").value || undefined,
        kaufpreis: zahlAusEingabe(document.getElementById("objKaufpreis")),
        wohnflaeche_qm: zahlAusEingabe(document.getElementById("objWohnflaeche")) || undefined,
        miete_kalt_monatlich: zahlAusEingabe(document.getElementById("objKaltmiete")),
      };
      const res = await apiFetch("/api/objekte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const neu = await res.json();
      objektId = neu.id;
    } else {
      objektId = Number(document.getElementById("objektAuswahl").value);
    }

    const finanzierung = {
      objekt_id: objektId,
      eigenkapital: zahlAusEingabe(document.getElementById("eigenkapital")),
      zinssatz: prozentAusEingabe(document.getElementById("zinssatz")),
      tilgungssatz: prozentAusEingabe(document.getElementById("tilgungssatz")),
      kaufnebenkosten_prozent: Number(document.getElementById("kaufnebenkosten").value),
      afa_prozent: Number(document.getElementById("afa").value),
      gebaeudeanteil_prozent: prozentAusEingabe(document.getElementById("gebaeudeanteil")),
      steuersatz_prozent: prozentAusEingabe(document.getElementById("steuersatz")),
      bewirtschaftungskosten_prozent: Number(document.getElementById("bewirtschaftungskosten").value),
      wertsteigerung_prozent: Number(document.getElementById("wertsteigerung").value),
      mietsteigerung_prozent: Number(document.getElementById("mietsteigerung").value),
      haltedauer_jahre: Number(document.getElementById("haltedauer").value),
      verkaufskosten_prozent: Number(document.getElementById("verkaufskosten").value),
    };

    const res = await apiFetch("/api/rendite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finanzierung),
    });
    const ergebnis = await res.json();
    if (ergebnis.error) { zeigeToast(ergebnis.error, "fehler"); return; }

    await ladeObjekte();
    document.getElementById("objektAuswahl").value = objektId;
    document.getElementById("objektAuswahl").dispatchEvent(new Event("change"));

    renderErgebnis(ergebnis);
    zeigeAnsicht("ergebnis");
  } catch (err) {
    zeigeToast("Verbindung fehlgeschlagen, bitte erneut versuchen.", "fehler");
  } finally {
    submitBtn.disabled = false;
    submitBtn.removeAttribute("aria-busy");
    submitBtn.classList.remove("btn-laedt");
  }
});

setzeFormularModus("neu");
aktualisiereNavAktiv("rechner");
ladeObjekte();
ladeVerlauf();
