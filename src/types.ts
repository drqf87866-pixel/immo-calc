export interface Env {
	immobilien_db: D1Database;
	GROQ_API_KEY: string;
}

export const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, X-Gast-Id",
};
