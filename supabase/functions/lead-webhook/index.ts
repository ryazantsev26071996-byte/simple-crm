import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TG_BOT_TOKEN")!;
const TG_CHAT_ID = Deno.env.get("TG_CHAT_ID")!;

async function parseBody(req: Request): Promise<Record<string, any>> {
  const contentType = req.headers.get("content-type") || "";
  const text = await req.text();
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  const params: Record<string, string> = {};
  for (const pair of text.split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
  }
  return params;
}

function extractLead(data: Record<string, any>) {
  let name = "";
  let phone = "";
  let source = "сайт";

  // Marquiz: contacts.phone и contacts.name
  if (data["contacts"]) {
    if (data["contacts"]["phone"]) phone = data["contacts"]["phone"];
    if (data["contacts"]["name"]) name = data["contacts"]["name"];
    source = "квиз";
  }

  // Tilda: Name, Phone
  if (data["Name"]) name = data["Name"];
  if (data["NAME"]) name = data["NAME"];
  if (data["Phone"]) phone = data["Phone"];
  if (data["PHONE"]) phone = data["PHONE"];

  if (data["formname"] || data["tildaspec"]) source = "сайт";

  phone = String(phone).replace(/[^+\d]/g, "");
  return { name: String(name).trim(), phone, source };
}

async function sendTelegram(name: string, phone: string, source: string, isDuplicate: boolean) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const prefix = isDuplicate ? "🔄 *Повторная заявка — Аура*" : "🎨 *Новый лид — Аура*";
  const text = `${prefix}\n\n👤 ${name || "Без имени"}\n📞 ${phone || "Без телефона"}\n📌 Источник: ${source}${isDuplicate ? "\n\n⚠️ Этот номер уже есть в CRM" : ""}`;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }});
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const data = await parseBody(req);
    const { name, phone, source } = extractLead(data);

    if (!phone && !name) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (phone) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, stage")
        .eq("phone", phone)
        .maybeSingle();

      if (existing) {
        await sendTelegram(name || existing.name, phone, source, true);
        return new Response(JSON.stringify({
          ok: true, duplicate: true, id: existing.id
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: name || "Без имени",
        phone: phone,
        source,
        stage: "новая заявка",
        lead_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    await sendTelegram(name, phone, source, false);

    return new Response(JSON.stringify({ ok: true, id: client.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
