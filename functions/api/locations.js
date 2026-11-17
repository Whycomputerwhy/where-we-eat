function json(data, options = {}) {
  return Response.json(data, options);
}

function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = COUNTRY_CODES.map((countryCode) => ({ country: countryNames.of(countryCode), countryCode }));

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const query = url.searchParams.get("q")?.trim();
  const country = url.searchParams.get("country")?.toUpperCase();

  if (!query || query.length < 2 || !["country", "city"].includes(kind)) {
    return json({ error: "Enter at least two characters to search." }, { status: 400 });
  }

  try {
    if (kind === "country") {
      const normalizedQuery = normalize(query);
      const results = COUNTRIES
        .filter((item) => normalize(item.country).includes(normalizedQuery))
        .sort((a, b) => a.country.localeCompare(b.country, "en"))
        .slice(0, 12);
      return json(results);
    }

    if (!country || !/^[A-Z]{2}$/.test(country)) {
      return json({ error: "Choose a country first." }, { status: 400 });
    }
    const parameters = new URLSearchParams({ name: query, count: "12", language: "en", countryCode: country });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
    if (!response.ok) throw new Error("City service unavailable");
    const data = await response.json();
    return json((data.results || []).map((place) => ({
      country: place.country,
      countryCode: place.country_code,
      city: place.name,
      longitude: place.longitude,
      latitude: place.latitude,
      region: place.admin1,
    })));
  } catch {
    return json({ error: `The ${kind} search is temporarily unavailable. Please try again.` }, { status: 502 });
  }
}
