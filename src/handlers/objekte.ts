import type { Env } from "../types";
import { corsHeaders } from "../types";

export interface ObjektInput {
	bezeichnung: string;
	kaufpreis: number;
	wohnflaeche_qm?: number;
	miete_kalt_monatlich: number;
	ort?: string;
}

export async function handleObjekteList(env: Env, gastId: string): Promise<Response> {
	const { results } = await env.immobilien_db
		.prepare("SELECT * FROM objekte WHERE gast_id = ? ORDER BY erstellt_am DESC")
		.bind(gastId)
		.all();
	return Response.json(results, { headers: corsHeaders });
}

export async function handleObjektCreate(request: Request, env: Env, gastId: string): Promise<Response> {
	const input: ObjektInput = await request.json();

	const result = await env.immobilien_db
		.prepare(
			`INSERT INTO objekte (bezeichnung, kaufpreis, wohnflaeche_qm, miete_kalt_monatlich, ort, gast_id, erstellt_am)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			input.bezeichnung,
			input.kaufpreis,
			input.wohnflaeche_qm ?? null,
			input.miete_kalt_monatlich,
			input.ort ?? null,
			gastId,
			new Date().toISOString()
		)
		.run();

	return Response.json({ id: result.meta.last_row_id }, { headers: corsHeaders });
}

export async function handleObjektUpdate(request: Request, env: Env, id: string, gastId: string): Promise<Response> {
	const input: ObjektInput = await request.json();

	const objekt = await env.immobilien_db
		.prepare("SELECT id FROM objekte WHERE id = ? AND gast_id = ?")
		.bind(id, gastId)
		.first();
	if (!objekt) {
		return new Response(JSON.stringify({ error: "Objekt nicht gefunden" }), { status: 404, headers: corsHeaders });
	}

	await env.immobilien_db
		.prepare(
			`UPDATE objekte SET bezeichnung = ?, kaufpreis = ?, wohnflaeche_qm = ?, miete_kalt_monatlich = ?, ort = ? WHERE id = ?`
		)
		.bind(input.bezeichnung, input.kaufpreis, input.wohnflaeche_qm ?? null, input.miete_kalt_monatlich, input.ort ?? null, id)
		.run();

	return new Response(null, { status: 204, headers: corsHeaders });
}

export async function handleObjektDelete(env: Env, id: string, gastId: string): Promise<Response> {
	const objekt = await env.immobilien_db
		.prepare("SELECT id FROM objekte WHERE id = ? AND gast_id = ?")
		.bind(id, gastId)
		.first();
	if (!objekt) {
		return new Response(JSON.stringify({ error: "Objekt nicht gefunden" }), { status: 404, headers: corsHeaders });
	}

	await env.immobilien_db
		.prepare(`DELETE FROM ki_einschaetzungen WHERE kalkulation_id IN (SELECT id FROM kalkulationen WHERE objekt_id = ?)`)
		.bind(id)
		.run();
	await env.immobilien_db
		.prepare("DELETE FROM kalkulationen WHERE objekt_id = ?")
		.bind(id)
		.run();
	await env.immobilien_db
		.prepare("DELETE FROM objekte WHERE id = ?")
		.bind(id)
		.run();

	return new Response(null, { status: 204, headers: corsHeaders });
}
