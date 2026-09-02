-- Mehrjahresprognose: Annahmen der Kalkulation persistieren, damit sie beim erneuten
-- Laden (handleKalkulationGet) unveraendert nachgerechnet werden koennen.
-- bewirtschaftungskosten_prozent existiert bereits seit 0001_initial_schema.sql.
ALTER TABLE kalkulationen ADD COLUMN wertsteigerung_prozent REAL;
ALTER TABLE kalkulationen ADD COLUMN mietsteigerung_prozent REAL;
ALTER TABLE kalkulationen ADD COLUMN haltedauer_jahre REAL;
ALTER TABLE kalkulationen ADD COLUMN verkaufskosten_prozent REAL;
