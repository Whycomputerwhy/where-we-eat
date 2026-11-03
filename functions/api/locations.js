function json(data, options = {}) {
  return Response.json(data, options);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const query = url.searchParams.get("q")?.trim();
  const country = url.searchParams.get("country");

  if (!env.MAPTILER_API_KEY) {
    return json({ error: "Location search has not been configured." }, { status: 503 });
  }
  if (!query || query.length < 2 || !["country", "city"].includes(kind)) {
    return json({ error: "Enter at least two characters to search." }, { status: 400 });
  }

  const parameters = new URLSearchParams({
    key: env.MAPTILER_API_KEY,
    autocomplete: "true",
    limit: "8",
    types: kind === "country" ? "country" : "municipality,municipal_district,locality,place",
  });
  if (kind === "city" && country) parameters.set("country", country);

  const response = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${parameters}`,
  );
  if (!response.ok) {
    return json({ error: "Location search is unavailable." }, { status: 502 });
  }

  const data = await response.json();
  const results = data.features
    .filter((feature) => feature.geometry?.type === "Point")
    .map((feature) => {
      const countryContext = feature.context?.find((item) => item.id?.startsWith("country."));
      const countryCode = (
        feature.properties?.country_code ||
        feature.properties?.short_code ||
        countryContext?.properties?.country_code ||
        countryContext?.short_code ||
        country ||
        ""
      ).toUpperCase();
      return {
        country: kind === "country" ? feature.text : countryContext?.text,
        countryCode,
        city: feature.text,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
      };
    })
    .filter((result) => result.country && result.countryCode);

  return json(results);
}
