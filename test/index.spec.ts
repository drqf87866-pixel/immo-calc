import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Immo-Calc Worker", () => {
	it("beantwortet /api/objekte ohne Gast-ID mit 400 (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/api/objekte");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		const body: any = await response.json();
		expect(body.error).toBe("Gast-ID fehlt");
	});

	it("liefert 404 fuer unbekannte API-Routen", async () => {
		const request = new IncomingRequest("http://example.com/api/unbekannt", {
			headers: { "X-Gast-Id": "test" },
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it("serviert die Startseite (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Immo-Calc");
	});

	it("serviert app.js als Asset (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/app.js");
		expect(response.status).toBe(200);
		expect((await response.text()).length).toBeGreaterThan(0);
	});

	it("beantwortet /api/objekte ohne Gast-ID mit 400 (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/api/objekte");
		expect(response.status).toBe(400);
		const body: any = await response.json();
		expect(body.error).toBe("Gast-ID fehlt");
	});
});
