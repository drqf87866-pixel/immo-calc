export interface RenditeInput {
	kaufpreis: number;
	miete_kalt_monatlich: number;
	eigenkapital: number;
	zinssatz: number;
	tilgungssatz: number;
	wohnflaeche_qm?: number;
	kaufnebenkosten_prozent?: number;
	afa_prozent?: number;
	gebaeudeanteil_prozent?: number;
	steuersatz_prozent?: number;
	/** Nicht umlagefaehige Bewirtschaftungskosten (Verwaltung, Instandhaltungsruecklage,
	 *  Mietausfallwagnis) als % der Jahreskaltmiete. Schmaelert Nettomietrendite und Cashflow. */
	bewirtschaftungskosten_prozent?: number;
	/** Angenommene jaehrliche Wertsteigerung der Immobilie in % (fuer die Mehrjahresprognose). */
	wertsteigerung_prozent?: number;
	/** Angenommene jaehrliche Mietsteigerung in % (fuer die Mehrjahresprognose). */
	mietsteigerung_prozent?: number;
	/** Geplante Haltedauer in Jahren bis zum (angenommenen) Verkauf. */
	haltedauer_jahre?: number;
	/** Verkaufsnebenkosten (z.B. Makler beim Exit) als % des Verkaufspreises. */
	verkaufskosten_prozent?: number;
}

export interface PrognoseJahr {
	jahr: number;
	restschuld: number;
	zins_jahr: number;
	tilgung_jahr: number;
	miete_jahr: number;
	bewirtschaftungskosten_jahr: number;
	cashflow_jahr: number;
	afa_jahr: number;
	steuerlicher_gewinn_jahr: number;
	steuer_jahr: number;
	cashflow_nach_steuern_jahr: number;
	immobilienwert: number;
}

function round0(n: number) {
	return Math.round(n);
}

function round2(n: number) {
	return Math.round(n * 100) / 100;
}

/**
 * Innerer Zinsfuss (IRR) einer Cashflow-Reihe (Index 0 = heute) per Bisektion.
 * Robust genug fuer den ueblichen Fall "ein Vorzeichenwechsel" (Investition -> Rueckfluesse);
 * bei mehreren Vorzeichenwechseln oder ohne Nullstelle im Suchbereich wird null geliefert.
 */
function berechneIrr(cashflows: number[]): number | null {
	const npv = (rate: number) => cashflows.reduce((summe, cf, t) => summe + cf / Math.pow(1 + rate, t), 0);

	let lo = -0.99;
	let hi = 10; // 1000 % - deckt jeden realistischen Immobilienfall ab
	let npvLo = npv(lo);
	const npvHi = npv(hi);
	if (!isFinite(npvLo) || !isFinite(npvHi) || npvLo * npvHi > 0) return null;

	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		const npvMid = npv(mid);
		if (Math.abs(npvMid) < 0.01) return mid;
		if (npvLo < 0 === npvMid < 0) {
			lo = mid;
			npvLo = npvMid;
		} else {
			hi = mid;
		}
	}
	return (lo + hi) / 2;
}

interface PrognoseBasis {
	darlehenssumme: number;
	jahreskaltmiete: number;
	bewirtschaftungskostenProzent: number;
	afaJahr: number;
	steuersatzProzent: number;
	gesamtinvestition: number;
}

/**
 * Mehrjahresprognose: Tilgungsverlauf (Annuitaet konstant, Zins-/Tilgungsanteil verschiebt sich),
 * Miet- und Wertentwicklung, sowie ein Verkaufsszenario am Ende der Haltedauer inkl. vereinfachter
 * Spekulationssteuer (§23 EStG: steuerfrei ab 10 Jahren Haltedauer) und Gesamtrendite (IRR) aufs
 * eingesetzte Eigenkapital. Vereinfachtes Modell fuer die Orientierung, keine Steuerberatung.
 */
function berechnePrognose(input: RenditeInput, basis: PrognoseBasis) {
	const wertsteigerungProzent = input.wertsteigerung_prozent ?? 2;
	const mietsteigerungProzent = input.mietsteigerung_prozent ?? 1.5;
	const haltedauerJahre = Math.max(1, Math.round(input.haltedauer_jahre ?? 10));
	const verkaufskostenProzent = input.verkaufskosten_prozent ?? 0;

	const annuitaetJahr = basis.darlehenssumme * ((input.zinssatz + input.tilgungssatz) / 100);

	let restschuld = basis.darlehenssumme;
	let kumulierteAfa = 0;
	let summeCashflowNachSteuern = 0;
	const jahre: PrognoseJahr[] = [];

	for (let jahr = 1; jahr <= haltedauerJahre; jahr++) {
		const zinsJahr = restschuld * (input.zinssatz / 100);
		let tilgungJahr = annuitaetJahr - zinsJahr;
		if (tilgungJahr > restschuld) tilgungJahr = restschuld; // Darlehen bereits getilgt: kappen
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

	// Restbuchwert = Gesamtinvestition abzueglich kumulierter AfA. Der Grundanteil (und der
	// darauf entfallende Teil der Kaufnebenkosten) wird nie abgeschrieben und bleibt so automatisch
	// im Restbuchwert stehen.
	const restbuchwert = Math.max(0, basis.gesamtinvestition - kumulierteAfa);
	const veraeusserungsgewinn = verkaufspreis - verkaufskosten - restbuchwert;

	// Vereinfachte Spekulationssteuer (§23 EStG): Verkauf innerhalb von 10 Jahren nach Kauf ->
	// Gewinn wird mit dem persoenlichen Steuersatz versteuert, ab 10 Jahren Haltedauer steuerfrei.
	const spekulationssteuerPflichtig = haltedauerJahre < 10 && veraeusserungsgewinn > 0;
	const spekulationssteuer = spekulationssteuerPflichtig ? veraeusserungsgewinn * (basis.steuersatzProzent / 100) : 0;

	const nettoerloes = verkaufspreis - verkaufskosten - restschuldBeiVerkauf - spekulationssteuer;
	const gesamtrueckfluss = summeCashflowNachSteuern + nettoerloes;

	const cashflowReihe = [-input.eigenkapital, ...jahre.map((j, i) => {
		const istVerkaufsjahr = i === jahre.length - 1;
		return j.cashflow_nach_steuern_jahr + (istVerkaufsjahr ? nettoerloes : 0);
	})];
	const irr = input.eigenkapital > 0 ? berechneIrr(cashflowReihe) : null;

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

export function berechneRendite(input: RenditeInput) {
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

	const kapitaldienstdeckungsgrad =
		kapitaldienstJahr > 0 ? nettobetriebsertragJahr / kapitaldienstJahr : null;

	const eigenkapitalrendite =
		input.eigenkapital > 0 ? (cashflowJahr / input.eigenkapital) * 100 : null;

	const afaBemessungsgrundlage = gesamtinvestition * (gebaeudeanteilProzent / 100);
	const afaJahr = afaBemessungsgrundlage * (afaProzent / 100);
	const steuerlicherGewinnJahr = nettobetriebsertragJahr - zinsenJahr - afaJahr;
	const steuerJahr = steuerlicherGewinnJahr * (steuersatzProzent / 100);
	const cashflowNachSteuernJahr = cashflowJahr - steuerJahr;

	const eigenkapitalrenditeNachSteuern =
		input.eigenkapital > 0 ? (cashflowNachSteuernJahr / input.eigenkapital) * 100 : null;

	const prognose = berechnePrognose(input, {
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
