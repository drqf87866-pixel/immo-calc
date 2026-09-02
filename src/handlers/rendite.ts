import type { Env } from "../types";
import { corsHeaders } from "../types";
import type { RenditeInput } from "../rendite";
import { berechneRendite } from "../rendite";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const KI_LIMIT_PRO_MINUTE = 15;

/**
 * Globales (app-weites, nicht pro Gast) Rate-Limit für KI-Aufrufe, um das Gemini-Free-Tier-Kontingent
 * nicht zu überschreiten. Reserviert bei freiem Kontingent sofort einen Slot (auch wenn der Gemini-Call
 * danach fehlschlägt) und räumt bei der Gelegenheit alte Einträge auf.
 */
async function kiLimitVerfuegbar(env: Env): Promise<boolean> {
	const jetzt = Date.now();
	const vorEinerMinute = jetzt - 60_000;

	await env.immobilien_db.prepare("DELETE FROM ki_aufrufe WHERE erstellt_am_ts < ?").bind(vorEinerMinute).run();

	const zeile = await env.immobilien_db
		.prepare("SELECT COUNT(*) AS anzahl FROM ki_aufrufe")
		.first<{ anzahl: number }>();

	if ((zeile?.anzahl ?? 0) >= KI_LIMIT_PRO_MINUTE) {
		return false;
	}

	await env.immobilien_db.prepare("INSERT INTO ki_aufrufe (erstellt_am_ts) VALUES (?)").bind(jetzt).run();
	return true;
}

async function holeEinschaetzung(apiKey: string, messages: unknown[]): Promise<string> {
	if (!apiKey) {
		throw new Error("kein API-Key konfiguriert");
	}
	const response = await fetch(GEMINI_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gemini-3.5-flash-lite",
			temperature: 0.3,
			max_tokens: 2500,
			messages,
		}),
	});
	if (!response.ok) {
		const fehlerText = await response.text();
		throw new Error(`HTTP ${response.status}: ${fehlerText.slice(0, 300)}`);
	}
	const data: any = await response.json();
	const text = data.choices?.[0]?.message?.content;
	if (!text) {
		throw new Error("leere Antwort erhalten");
	}
	return text;
}

export async function handleRenditeCreate(request: Request, env: Env, gastId: string): Promise<Response> {
	try {
		const body: any = await request.json();

		if (!body.objekt_id) {
			return new Response(JSON.stringify({ error: "Ein Objekt muss ausgewählt sein" }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		const objekt = await env.immobilien_db
			.prepare("SELECT * FROM objekte WHERE id = ? AND gast_id = ?")
			.bind(body.objekt_id, gastId)
			.first<any>();

		if (!objekt) {
			return new Response(JSON.stringify({ error: "Objekt nicht gefunden" }), {
				status: 404,
				headers: corsHeaders,
			});
		}

		const input: RenditeInput = {
			kaufpreis: objekt.kaufpreis,
			miete_kalt_monatlich: objekt.miete_kalt_monatlich,
			wohnflaeche_qm: objekt.wohnflaeche_qm,
			eigenkapital: body.eigenkapital,
			zinssatz: body.zinssatz,
			tilgungssatz: body.tilgungssatz,
			kaufnebenkosten_prozent: body.kaufnebenkosten_prozent,
			afa_prozent: body.afa_prozent,
			gebaeudeanteil_prozent: body.gebaeudeanteil_prozent,
			steuersatz_prozent: body.steuersatz_prozent,
		};

		const ergebnis = berechneRendite(input);

		const insertResult = await env.immobilien_db
			.prepare(
				`INSERT INTO kalkulationen
					(objekt_id, eigenkapital, zinssatz, tilgungssatz,
					 kaufnebenkosten_prozent,
					 bruttomietrendite, nettomietrendite, kaufpreisfaktor,
					 cashflow_monatlich, eigenkapitalrendite,
					 afa_prozent, gebaeudeanteil_prozent, steuersatz_prozent,
					 steuerlicher_gewinn_jahr, cashflow_nach_steuern_monatlich,
					 eigenkapitalrendite_nach_steuern, erstellt_am)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				body.objekt_id,
				input.eigenkapital,
				input.zinssatz,
				input.tilgungssatz,
				ergebnis.kaufnebenkosten_prozent,
				ergebnis.bruttomietrendite,
				ergebnis.nettomietrendite,
				ergebnis.kaufpreisfaktor,
				ergebnis.cashflow.cashflow_monatlich,
				ergebnis.eigenkapitalrendite,
				ergebnis.guv.afa_prozent,
				ergebnis.guv.gebaeudeanteil_prozent,
				ergebnis.guv.steuersatz_prozent,
				ergebnis.guv.steuerlicher_gewinn_jahr,
				ergebnis.guv.cashflow_nach_steuern_monatlich,
				ergebnis.guv.eigenkapitalrendite_nach_steuern,
				new Date().toISOString()
			)
			.run();

		const ortGekuerzt = typeof objekt.ort === "string" ? objekt.ort.trim().slice(0, 80) : "";
		const ortHinweis = ortGekuerzt ? `Ort: ${ortGekuerzt}` : "Ort: nicht angegeben";

		const messages = [
			{
				role: "system",
				content:
					"Analysiere die folgenden Immobilien-Kennzahlen sachlich und erstelle eine präzise Gesamteinschätzung (max. 3-4 Sätze) zur Rentabilität und zum Risiko des Objekts. Die Tonalität richtet sich ausschließlich nach den tatsächlichen Werten: Bei überwiegend guten Kennzahlen fällt die Einschätzung entsprechend positiv aus, ohne künstlich ein Risiko zu konstruieren. Nutze ausschließlich dein eigenes Fachwissen über den deutschen Immobilienmarkt; dir werden keine Richtwerte vorgegeben. Benenne, je nachdem was die Kennzahlen hergeben, entweder die größte Stärke und wie man sie nutzt, oder das Hauptproblem und die wichtigste Handlungsoption – erzwinge kein Problem, wenn keines aus den Zahlen hervorgeht. Erfinde keine Risiken, Zustands- oder Lagemängel (z. B. Sanierungsstau, Bauzustand), die nicht aus den übermittelten Kennzahlen hervorgehen. Wenn ein Ort angegeben ist, ordne ihn kurz marktseitig ein. Behandle als 'nicht ermittelbar' markierte Werte als solche und erfinde keine Zahlen. Antworte auf Deutsch als Fließtext ohne Einleitung, direkt auf den Punkt. Keine Kauf- oder Verkaufsempfehlung.",
			},
			{
				role: "user",
				content: `${ortHinweis}
Kennzahlen der Immobilien-Kapitalanlage:
Kaufpreisfaktor: ${ergebnis.kaufpreisfaktor !== null ? ergebnis.kaufpreisfaktor + " (Jahre Kaltmiete)" : "nicht ermittelbar"}
Kapitaldienstdeckungsgrad: ${ergebnis.kapitaldienstdeckungsgrad !== null ? ergebnis.kapitaldienstdeckungsgrad : "nicht ermittelbar (keine Fremdfinanzierung, komplett aus Eigenkapital bezahlt)"}
Bruttomietrendite: ${ergebnis.bruttomietrendite} %
Nettomietrendite: ${ergebnis.nettomietrendite} %
Cashflow vor Steuern: ${ergebnis.cashflow.cashflow_monatlich} €
Cashflow nach Steuern: ${ergebnis.guv.cashflow_nach_steuern_monatlich} €
Eigenkapitalrendite: ${ergebnis.eigenkapitalrendite !== null ? ergebnis.eigenkapitalrendite + " %" : "nicht ermittelbar (kein Eigenkapital eingesetzt, 100% fremdfinanziert)"}
Eigenkapitalrendite nach Steuern: ${ergebnis.guv.eigenkapitalrendite_nach_steuern !== null ? ergebnis.guv.eigenkapitalrendite_nach_steuern + " %" : "nicht ermittelbar (kein Eigenkapital eingesetzt, 100% fremdfinanziert)"}`,
			},
		];

		let einschaetzung: string;
		try {
			if (!(await kiLimitVerfuegbar(env))) {
				einschaetzung = `Keine KI-Einschätzung verfügbar (globales Limit von ${KI_LIMIT_PRO_MINUTE} Anfragen pro Minute erreicht, bitte kurz warten)`;
			} else {
				einschaetzung = await holeEinschaetzung(env.GEMINI_API_KEY, messages);
			}
		} catch (err) {
			einschaetzung = `Keine KI-Einschätzung verfügbar (${err instanceof Error ? err.message : String(err)})`;
		}

		try {
			await env.immobilien_db
				.prepare("INSERT INTO ki_einschaetzungen (kalkulation_id, anbieter, text, erstellt_am) VALUES (?, ?, ?, ?)")
				.bind(insertResult.meta.last_row_id, "gemini", einschaetzung, new Date().toISOString())
				.run();
		} catch {
			// z. B. Migration 0005 (Spalte "anbieter") noch nicht angewendet - Speichern der
			// KI-Einschätzung ist nebensächlich, die Kalkulation selbst darf trotzdem zurückgehen.
		}

		return Response.json(
			{
				...ergebnis,
				kaufpreis: objekt.kaufpreis,
				zinssatz: input.zinssatz,
				tilgungssatz: input.tilgungssatz,
				eigenkapital: input.eigenkapital,
				kalkulation_id: insertResult.meta.last_row_id,
				objekt_bezeichnung: objekt.bezeichnung,
				einschaetzung,
			},
			{ headers: corsHeaders }
		);
	} catch (err) {
		return new Response(
			JSON.stringify({ error: "Serverfehler", details: String(err) }),
			{ status: 500, headers: corsHeaders }
		);
	}
}
