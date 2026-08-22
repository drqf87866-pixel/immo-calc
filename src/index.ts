import type { Env } from "./types";
import { corsHeaders } from "./types";
import { handleObjekteList, handleObjektCreate, handleObjektUpdate, handleObjektDelete } from "./handlers/objekte";
import { handleRenditeCreate } from "./handlers/rendite";
import { handleKalkulationenList, handleKalkulationGet, handleKalkulationDelete } from "./handlers/kalkulationen";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (!url.pathname.startsWith("/api/")) {
			return new Response("Not found", { status: 404 });
		}

		const gastId = request.headers.get("X-Gast-Id");
		if (!gastId) {
			return new Response(JSON.stringify({ error: "Gast-ID fehlt" }), { status: 400, headers: corsHeaders });
		}

		if (url.pathname === "/api/objekte" && request.method === "GET") {
			return handleObjekteList(env, gastId);
		}
		if (url.pathname === "/api/objekte" && request.method === "POST") {
			return handleObjektCreate(request, env, gastId);
		}
		if (url.pathname.startsWith("/api/objekte/") && request.method === "PUT") {
			return handleObjektUpdate(request, env, url.pathname.split("/").pop()!, gastId);
		}
		if (url.pathname.startsWith("/api/objekte/") && request.method === "DELETE") {
			return handleObjektDelete(env, url.pathname.split("/").pop()!, gastId);
		}

		if (url.pathname === "/api/rendite" && request.method === "POST") {
			return handleRenditeCreate(request, env, gastId);
		}

		if (url.pathname === "/api/kalkulationen" && request.method === "GET") {
			return handleKalkulationenList(env, gastId);
		}
		if (url.pathname.startsWith("/api/kalkulationen/") && request.method === "GET") {
			return handleKalkulationGet(env, url.pathname.split("/").pop()!, gastId);
		}
		if (url.pathname.startsWith("/api/kalkulationen/") && request.method === "DELETE") {
			return handleKalkulationDelete(env, url.pathname.split("/").pop()!, gastId);
		}

		return new Response("Not found", { status: 404, headers: corsHeaders });
	},
} satisfies ExportedHandler<Env>;
