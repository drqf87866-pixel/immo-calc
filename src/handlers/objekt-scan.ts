import type { Env } from "../types";
import { corsHeaders } from "../types";

export async function handleObjektScan(request: Request, env: Env): Promise<Response> {
	try {
		const body: any = await request.json();
		const text = String(body.text ?? "").trim();

		if (!text) {
			return new Response(JSON.stringify({ error: "Kein Text übergeben" }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		// Grob begrenzen, falls jemand aus Versehen die ganze Seite statt nur die Anzeige einfügt
		const gekuerzterText = text.slice(0, 6000);

		const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.GROQ_API_KEY}`,
			},
			body: JSON.stringify({
				model: "openai/gpt-oss-20b",
				reasoning_effort: "low",
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content:
							'Du extrahierst strukturierte Daten aus dem eingefügten Text einer Immobilien-Verkaufsanzeige (z.B. von ImmoScout24). Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärung, ohne Markdown-Codeblock, ohne Einleitung, in exakt diesem Format: {"bezeichnung": string oder null, "ort": string oder null, "kaufpreis": number oder null, "wohnflaeche_qm": number oder null, "miete_kalt_monatlich": number oder null}. bezeichnung ist ein kurzer, sprechender Titel der Anzeige (z.B. Wohnungstyp + Lage). ort ist die Stadt bzw. der Ort der Immobilie (ohne Straße/PLZ, z.B. "München" statt "80331 München, Schwabing"). kaufpreis ist der Kaufpreis der Immobilie in Euro als reine Zahl ohne Tausenderpunkte oder Währungszeichen. wohnflaeche_qm ist die Wohnfläche in Quadratmetern als reine Zahl. miete_kalt_monatlich ist die monatliche Kaltmiete/Mieteinnahme in Euro als reine Zahl, nur zu befüllen, wenn der Text explizit eine Mieteinnahme nennt (z.B. bei bereits vermieteten Kapitalanlagen), sonst null. WICHTIG: Achte genau darauf, ob die genannte Miete ein Monats- oder ein Jahreswert ist - Kapitalanlage-Anzeigen nennen oft die Jahresmiete (Bezeichnungen wie "Jahresmiete", "Jahresnettokaltmiete", "Mieteinnahmen p.a.", "Mieteinnahmen pro Jahr", "Jahresrohertrag"). Ist ein Jahreswert erkennbar, teile ihn durch 12 und runde auf ganze Euro, damit miete_kalt_monatlich immer der Monatswert ist. Ist nicht eindeutig erkennbar, ob es sich um einen Monats- oder Jahreswert handelt, setze null statt zu raten. Erfinde keine Zahlen.',
					},
					{
						role: "user",
						content: gekuerzterText,
					},
				],
				max_completion_tokens: 1024,
				temperature: 0,
			}),
		});

		if (!aiResponse.ok) {
			const fehlerText = await aiResponse.text();
			throw new Error(`Groq-Fehler (${aiResponse.status}): ${fehlerText}`);
		}

		const aiData: any = await aiResponse.json();
		const rohtext: string = aiData.choices?.[0]?.message?.content ?? "";

		const jsonMatch = rohtext.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return new Response(JSON.stringify({ error: "Anzeige konnte nicht ausgelesen werden" }), {
				status: 502,
				headers: corsHeaders,
			});
		}

		let daten: any;
		try {
			daten = JSON.parse(jsonMatch[0]);
		} catch {
			return new Response(JSON.stringify({ error: "Anzeige konnte nicht ausgelesen werden" }), {
				status: 502,
				headers: corsHeaders,
			});
		}

		return Response.json(
			{
				bezeichnung: typeof daten.bezeichnung === "string" ? daten.bezeichnung : null,
				ort: typeof daten.ort === "string" ? daten.ort : null,
				kaufpreis: typeof daten.kaufpreis === "number" ? daten.kaufpreis : null,
				wohnflaeche_qm: typeof daten.wohnflaeche_qm === "number" ? daten.wohnflaeche_qm : null,
				miete_kalt_monatlich: typeof daten.miete_kalt_monatlich === "number" ? daten.miete_kalt_monatlich : null,
			},
			{ headers: corsHeaders }
		);
	} catch (err) {
		return new Response(JSON.stringify({ error: "Serverfehler", details: String(err) }), {
			status: 500,
			headers: corsHeaders,
		});
	}
}
