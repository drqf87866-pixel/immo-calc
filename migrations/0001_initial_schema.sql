CREATE TABLE bodenrichtwerte (
  id INTEGER PRIMARY KEY,
  bundesland TEXT,
  zone_id TEXT,
  zone_name TEXT,
  jahr INTEGER,
  wert_eur_qm REAL
);

CREATE TABLE haeuserpreisindex (
  id INTEGER PRIMARY KEY,
  region_typ TEXT,
  jahr INTEGER,
  quartal INTEGER,
  index_wert REAL
);

CREATE TABLE grunderwerbsteuer_saetze (
  bundesland TEXT PRIMARY KEY,
  satz_prozent REAL,
  gueltig_ab TEXT
);

CREATE TABLE objekte (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  bezeichnung TEXT,
  plz TEXT,
  bundesland TEXT,
  zone_id TEXT REFERENCES bodenrichtwerte(zone_id),
  wohnflaeche_qm REAL,
  baujahr INTEGER,
  erstellt_am TEXT
);

CREATE TABLE kalkulationen (
  id INTEGER PRIMARY KEY,
  objekt_id INTEGER REFERENCES objekte(id),
  kaufpreis REAL,
  miete_kalt_monatlich REAL,
  eigenkapital REAL,
  zinssatz REAL,
  tilgungssatz REAL,
  makler_prozent REAL,
  bewirtschaftungskosten_prozent REAL,
  bruttomietrendite REAL,
  nettomietrendite REAL,
  kaufpreisfaktor REAL,
  cashflow_monatlich REAL,
  eigenkapitalrendite REAL,
  erstellt_am TEXT
);

CREATE TABLE ki_einschaetzungen (
  id INTEGER PRIMARY KEY,
  kalkulation_id INTEGER REFERENCES kalkulationen(id),
  text TEXT,
  erstellt_am TEXT
);