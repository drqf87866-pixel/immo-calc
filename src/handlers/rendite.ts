import type { Env } from "../types";
import { corsHeaders } from "../types";
import type { RenditeInput } from "../rendite";
import { berechneRendite } from "../rendite";

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

		const geminiResponse = await fetch(
			"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.GEMINI_API_KEY}`,
				},
				body: JSON.stringify({
					model: "gemini-3.6-flash",
				messages: [
					{
						role: "system",
						content:
							"Du bist ein sachlicher Immobilien-Analyse-Assistent. Du gibst eine Gesamteinschätzung zu einer Kapitalanlage-Immobilie ab, keine Bewertung einzelner Kennzahlen. Wenn ein Ort angegeben ist und dir dazu aus deinem Wissen etwas zum dortigen Immobilienmarkt bekannt ist (z.B. ob es eine gefragte Großstadt oder eher ländlich ist), darfst du das kurz einordnend erwähnen. Nutze ansonsten diese bundesweiten Richtwerte für den deutschen Markt 2026: Kaufpreisfaktor - bis 20 günstig, 20-25 akzeptabel, über 30 teuer, in Großstädten sind 25-45 normal. Kapitaldienstdeckungsgrad - Werte ab 1 bedeuten, dass die Miete den Kapitaldienst (Zins und Tilgung) vollständig deckt, Banken verlangen oft mindestens 1,2. Bruttomietrendite - unter 3% niedrig, 4-6% solide, deutlich darüber meist nur außerhalb von Metropolen üblich. Nettomietrendite - 2,5-4% üblich für gute Objekte, deutlich über 4% eher ein Hinweis auf erhöhtes Risiko statt auf ein besonders gutes Geschäft. Eigenkapitalrendite - bewerte relativ zum Zinssatz: liegt sie klar darüber, wirkt der Kredit-Hebel positiv, liegt sie darunter oder ist negativ, wirkt er negativ. Eigenkapitalrendite nach Steuern - vergleiche sie mit der Eigenkapitalrendite vor Steuern: ist sie spürbar höher, zeigen das Steuervorteile. Cashflow vor und nach Steuern - das Vorzeichen zählt: positiv heißt die Immobilie trägt sich selbst, negativ heißt laufender Zuschussbedarf. Falls einzelne Kennzahlen als 'nicht ermittelbar' markiert sind, geh kurz darauf ein, ohne eine Zahl zu erfinden. Schreibe genau 3 Sätze, die das Zusammenspiel der Kennzahlen einordnen: wie passen Kaufpreis, Finanzierung, Rendite und Cashflow zusammen, wo liegen die Stärken oder Schwachstellen im Gesamtbild. Antworte als Fließtext, genau 3 Sätze, auf Deutsch. Keine Einleitung, keine Aufzählungszeichen, keine Kauf- oder Verkaufsempfehlung.",
					},
					{
						role: "user",
						content: `${ortHinweis}
Ordne folgende Kennzahlen einer Immobilien-Kapitalanlage im Zusammenspiel ein:
Kaufpreisfaktor: ${ergebnis.kaufpreisfaktor !== null ? ergebnis.kaufpreisfaktor + " (Jahre Kaltmiete)" : "nicht ermittelbar"}
Kapitaldienstdeckungsgrad: ${ergebnis.kapitaldienstdeckungsgrad !== null ? ergebnis.kapitaldienstdeckungsgrad : "nicht ermittelbar (keine Fremdfinanzierung, komplett aus Eigenkapital bezahlt)"}
Bruttomietrendite: ${ergebnis.bruttomietrendite} %
Nettomietrendite: ${ergebnis.nettomietrendite} %
Cashflow vor Steuern: ${ergebnis.cashflow.cashflow_monatlich} €
Cashflow nach Steuern: ${ergebnis.guv.cashflow_nach_steuern_monatlich} €
Eigenkapitalrendite: ${ergebnis.eigenkapitalrendite !== null ? ergebnis.eigenkapitalrendite + " %" : "nicht ermittelbar (kein Eigenkapital eingesetzt, 100% fremdfinanziert)"}
Eigenkapitalrendite nach Steuern: ${ergebnis.guv.eigenkapitalrendite_nach_steuern !== null ? ergebnis.guv.eigenkapitalrendite_nach_steuern + " %" : "nicht ermittelbar (kein Eigenkapital eingesetzt, 100% fremdfinanziert)"}`,
					},
				],
				max_tokens: 1024,
				temperature: 0.3,
			}),
		});

		if (!geminiResponse.ok) {
			const fehlerText = await geminiResponse.text();
			throw new Error(`Gemini-Fehler (${geminiResponse.status}): ${fehlerText}`);
		}

		const geminiData: any = await geminiResponse.json();
		const einschaetzungText: string =
			geminiData.choices?.[0]?.message?.content ?? "Keine KI-Einschätzung verfügbar.";

		await env.immobilien_db
			.prepare("INSERT INTO ki_einschaetzungen (kalkulation_id, text, erstellt_am) VALUES (?, ?, ?)")
			.bind(insertResult.meta.last_row_id, einschaetzungText, new Date().toISOString())
			.run();

		return Response.json(
			{
				...ergebnis,
				kaufpreis: objekt.kaufpreis,
				zinssatz: input.zinssatz,
				tilgungssatz: input.tilgungssatz,
				eigenkapital: input.eigenkapital,
				kalkulation_id: insertResult.meta.last_row_id,
				objekt_bezeichnung: objekt.bezeichnung,
				einschaetzung: einschaetzungText,
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