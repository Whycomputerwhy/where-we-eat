var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/recipes.js
var MAX_PHOTOS = 4;
var MAX_PHOTO_SIZE = 5 * 1024 * 1024;
function json(data, options = {}) {
  return Response.json(data, options);
}
__name(json, "json");
function photoUrl(key) {
  return `/api/images/${encodeURIComponent(key)}`;
}
__name(photoUrl, "photoUrl");
async function onRequestGet({ env }) {
  const { results } = await env.RECIPES_DB.prepare(
    `SELECT id, country, city, recipe_name, submitter_name, ingredients, instructions,
            latitude, longitude, photo_keys, created_at
       FROM recipes
       ORDER BY created_at DESC`
  ).all();
  return json(
    results.map((recipe) => ({
      ...recipe,
      photoUrls: JSON.parse(recipe.photo_keys).map(photoUrl)
    }))
  );
}
__name(onRequestGet, "onRequestGet");
async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const country = form.get("country")?.trim();
  const city = form.get("city")?.trim();
  const recipeName = form.get("recipeName")?.trim();
  const submitterName = form.get("submitterName")?.trim() || null;
  const ingredients = form.get("ingredients")?.trim();
  const instructions = form.get("instructions")?.trim();
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const photos = form.getAll("photos").filter((entry) => entry instanceof File && entry.size > 0);
  if (!country || !city || !recipeName || !ingredients || !instructions) {
    return json({ error: "Complete every recipe field." }, { status: 400 });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return json({ error: "Choose a valid map location." }, { status: 400 });
  }
  if (photos.length > MAX_PHOTOS || photos.some((photo) => !photo.type.startsWith("image/") || photo.size > MAX_PHOTO_SIZE)) {
    return json({ error: "Add up to four image files, each no larger than 5 MB." }, { status: 400 });
  }
  const photoKeys = [];
  for (const photo of photos) {
    const extension = photo.type.split("/")[1] || "image";
    const key = `${crypto.randomUUID()}.${extension}`;
    await env.RECIPE_IMAGES.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type }
    });
    photoKeys.push(key);
  }
  const id = crypto.randomUUID();
  await env.RECIPES_DB.prepare(
    `INSERT INTO recipes (
      id, country, city, recipe_name, submitter_name, ingredients, instructions,
      latitude, longitude, photo_keys
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    country,
    city,
    recipeName,
    submitterName,
    ingredients,
    instructions,
    latitude,
    longitude,
    JSON.stringify(photoKeys)
  ).run();
  return json({ id }, { status: 201 });
}
__name(onRequestPost, "onRequestPost");

// functions/api/images/[key].js
async function onRequestGet2({ params, env }) {
  const object = await env.RECIPE_IMAGES.get(params.key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
__name(onRequestGet2, "onRequestGet");

// functions/api/locations.js
function json2(data, options = {}) {
  return Response.json(data, options);
}
__name(json2, "json");
function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}
__name(normalize, "normalize");
var COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");
var countryNames = new Intl.DisplayNames(["en"], { type: "region" });
var COUNTRIES = COUNTRY_CODES.map((countryCode) => ({ country: countryNames.of(countryCode), countryCode }));
async function onRequestGet3({ request }) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const query = url.searchParams.get("q")?.trim();
  const country = url.searchParams.get("country")?.toUpperCase();
  if (!query || query.length < 2 || !["country", "city"].includes(kind)) {
    return json2({ error: "Enter at least two characters to search." }, { status: 400 });
  }
  try {
    if (kind === "country") {
      const normalizedQuery = normalize(query);
      const results = COUNTRIES.filter((item) => normalize(item.country).includes(normalizedQuery)).sort((a, b) => a.country.localeCompare(b.country, "en")).slice(0, 12);
      return json2(results);
    }
    if (!country || !/^[A-Z]{2}$/.test(country)) {
      return json2({ error: "Choose a country first." }, { status: 400 });
    }
    const parameters = new URLSearchParams({ name: query, count: "12", language: "en", countryCode: country });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
    if (!response.ok) throw new Error("City service unavailable");
    const data = await response.json();
    return json2((data.results || []).map((place) => ({
      country: place.country,
      countryCode: place.country_code,
      city: place.name,
      longitude: place.longitude,
      latitude: place.latitude,
      region: place.admin1
    })));
  } catch {
    return json2({ error: `The ${kind} search is temporarily unavailable. Please try again.` }, { status: 502 });
  }
}
__name(onRequestGet3, "onRequestGet");

// src/worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/recipes") {
      if (request.method === "GET") return onRequestGet({ env });
      if (request.method === "POST") return onRequestPost({ request, env });
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/api/locations") {
      if (request.method === "GET") return onRequestGet3({ request, env });
      return new Response("Method not allowed", { status: 405 });
    }
    const imageMatch = url.pathname.match(/^\/api\/images\/([^/]+)$/);
    if (request.method === "GET" && imageMatch) {
      return onRequestGet2({ params: { key: decodeURIComponent(imageMatch[1]) }, env });
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../.nvm/versions/node/v24.12.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.nvm/versions/node/v24.12.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Tm0qam/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.nvm/versions/node/v24.12.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Tm0qam/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
