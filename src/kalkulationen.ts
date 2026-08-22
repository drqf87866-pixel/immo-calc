import type { Env } from "../types";
import { corsHeaders } from "../types";
import { berechneRendite } from "../rendite";

export async function handleKalkulationenList(env: Env): Promise<Response> {
	const { results } = await env.immobilien_db
		.prepare(
			`SELECT kalkulationen.*, objekte.bezeichnung AS objekt_bezeichnung
			 FROM kalkulationen
			 LEFT JOIN objekte ON kalkulationen.objekt_id = objekte.id
			 ORDER BY kalkulationen.erstellt_am DESC`
		)
		.all();
	return Response.json(results, { headers: corsHeaders });
}

export async function handleKalkulationGet(env: Env, id: string): Promise<Response> {
	const row = await env.immobilien_db
		.prepare(
			`SELECT kalkulationen.*, objekte.bezeichnung AS objekt_bezeichnung,
			        objekte.kaufpreis AS objekt_kaufpreis,
			        objekte.wohnflaeche_qm AS objekt_wohnflaeche_qm,
			        objekte.miete_kalt_monatlich AS objekt_miete_kalt_monatlich
			 FROM kalkulationen
			 LEFT JOIN objekte ON kalkulationen.objekt_id = objekte.id
			 WHERE kalkulationen.id = ?`
		)
		.bind(id)
		.first<any>();

	if (!row) {
		return new Response(JSON.stringify({ error: "Nicht gefunden" }), { status: 404, headers: corsHeaders });
	}

	const ergebnis = berechneRendite({
		kaufpreis: row.objekt_kaufpreis,
		miete_kalt_monatlich: row.objekt_miete_kalt_monatlich,
		wohnflaeche_qm: row.objekt_wohnflaeche_qm,
		eigenkapital: row.eigenkapital,
		zinssatz: row.zinssatz,
		tilgungssatz: row.tilgungssatz,
		kaufnebenkosten_prozent: row.kaufnebenkosten_prozent,
		afa_prozent: row.afa_prozent,
		gebaeudeanteil_prozent: row.gebaeudeanteil_prozent,
		steuersatz_prozent: row.steuersatz_prozent,
	});

	const einschaetzung = await env.immobilien_db
		.prepare("SELECT text FROM ki_einschaetzungen WHERE kalkulation_id = ? ORDER BY id DESC LIMIT 1")
		.bind(id)
		.first<{ text: string }>();

	return Response.json(
		{
			...ergebnis,
			kaufpreis: row.objekt_kaufpreis,
			zinssatz: row.zinssatz,
			tilgungssatz: row.tilgungssatz,
			eigenkapital: row.eigenkapital,
			kalkulation_id: row.id,
			objekt_bezeichnung: row.objekt_bezeichnung,
			erstellt_am: row.erstellt_am,
			einschaetzung: einschaetzung?.text ?? "Keine Einschätzung gespeichert.",
		},
		{ headers: corsHeaders }
	);
}

export async function handleKalkulationDelete(env: Env, id: string): Promise<Response> {
	await env.immobilien_db
		.prepare("DELETE FROM ki_einschaetzungen WHERE kalkulation_id = ?")
		.bind(id)
		.run();
	await env.immobilien_db
		.prepare("DELETE FROM kalkulationen WHERE id = ?")
		.bind(id)
		.run();

	return new Response(null, { status: 204, headers: corsHeaders });
}
