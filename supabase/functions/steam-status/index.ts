const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const vanityName = "djxd_17";

function jsonResponse(body: unknown, status = 200, cacheControl = "no-store") {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": cacheControl },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("STEAM_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Steam API key is not configured in Supabase" }, 503);
  }

  try {
    const resolveUrl = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
    resolveUrl.searchParams.set("key", apiKey);
    resolveUrl.searchParams.set("vanityurl", vanityName);
    const resolveResponse = await fetch(resolveUrl);
    if (!resolveResponse.ok) {
      throw new Error(`Steam profile lookup failed (${resolveResponse.status})`);
    }

    const resolved = await resolveResponse.json();
    const steamId = resolved?.response?.steamid;
    if (resolved?.response?.success !== 1 || typeof steamId !== "string") {
      return jsonResponse({ error: "Steam profile was not found" }, 404);
    }

    const playerUrl = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    playerUrl.searchParams.set("key", apiKey);
    playerUrl.searchParams.set("steamids", steamId);
    const playerResponse = await fetch(playerUrl);
    if (!playerResponse.ok) {
      throw new Error(`Steam status lookup failed (${playerResponse.status})`);
    }

    const playerData = await playerResponse.json();
    const player = playerData?.response?.players?.[0];
    if (!player) {
      return jsonResponse({ error: "Steam profile is unavailable" }, 404);
    }

    return jsonResponse({
      personaName: typeof player.personaname === "string" ? player.personaname : vanityName,
      avatarUrl: typeof player.avatarfull === "string" ? player.avatarfull : null,
      gameName: typeof player.gameextrainfo === "string" ? player.gameextrainfo : null,
      isPublic: player.communityvisibilitystate === 3,
      isOnline: typeof player.personastate === "number" && player.personastate > 0,
    }, 200, "public, max-age=60");
  } catch (error) {
    console.error("Steam status lookup failed:", error);
    return jsonResponse({ error: "Steam status is temporarily unavailable" }, 502);
  }
});
