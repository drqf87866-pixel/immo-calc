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
}

function round0(n: number) {
	return Math.round(n);
}

function round2(n: number) {
	return Math.round(n * 100) / 100;
}

export function berechneRendite(input: RenditeInput) {
	const kaufnebenkostenProzent = input.kaufnebenkosten_prozent ?? 10;
	const afaProzent = input.afa_prozent ?? 2;
	const gebaeudeanteilProzent = input.gebaeudeanteil_prozent ?? 80;
	const steuersatzProzent = input.steuersatz_prozent ?? 0;

	const kaufnebenkosten = input.kaufpreis * (kaufnebenkostenProzent / 100);
	const gesamtinvestition = input.kaufpreis + kaufnebenkosten;

	const jahreskaltmiete = input.miete_kalt_monatlich * 12;

	const bruttomietrendite = (jahreskaltmiete / input.kaufpreis) * 100;
	const nettomietrendite = (jahreskaltmiete / gesamtinvestition) * 100;
	const kaufpreisfaktor = input.kaufpreis / jahreskaltmiete;

	const kaufpreisProQm =
		input.wohnflaeche_qm && input.wohnflaeche_qm > 0
			? input.kaufpreis / input.wohnflaeche_qm
			: null;

	const darlehenssumme = gesamtinvestition - input.eigenkapital;
	const zinsenJahr = darlehenssumme * (input.zinssatz / 100);
	const tilgungJahr = darlehenssumme * (input.tilgungssatz / 100);
	const kapitaldienstJahr = zinsenJahr + tilgungJahr;
	const cashflowJahr = jahreskaltmiete - kapitaldienstJahr;

	const kapitaldienstdeckungsgrad = kapitaldienstJahr > 0 ? jahreskaltmiete / kapitaldienstJahr : null;

	const eigenkapitalrendite =
		input.eigenkapital > 0 ? (cashflowJahr / input.eigenkapital) * 100 : null;

	const afaBemessungsgrundlage = gesamtinvestition * (gebaeudeanteilProzent / 100);
	const afaJahr = afaBemessungsgrundlage * (afaProzent / 100);
	const steuerlicherGewinnJahr = jahreskaltmiete - zinsenJahr - afaJahr;
	const steuerJahr = steuerlicherGewinnJahr * (steuersatzProzent / 100);
	const cashflowNachSteuernJahr = cashflowJahr - steuerJahr;

	const eigenkapitalrenditeNachSteuern =
		input.eigenkapital > 0 ? (cashflowNachSteuernJahr / input.eigenkapital) * 100 : null;

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
			zins_monatlich: round0(zinsenJahr / 12),
			tilgung_monatlich: round0(tilgungJahr / 12),
			cashflow_monatlich: round0(cashflowJahr / 12),
		},
		guv: {
			miete_jahr: round0(jahreskaltmiete),
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
	};
}
