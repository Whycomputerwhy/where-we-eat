const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const DISPLAYABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const HEIC_IMAGE_TYPES = new Set(["image/heic", "image/heif"]);

function json(data, options = {}) {
  return Response.json(data, options);
}

function photoUrl(key) {
  return `/api/images/${encodeURIComponent(key)}`;
}

async function convertHeicToJpg(photo, env) {
  if (!env.HEIC_JPG_API_KEY) {
    throw new Error("HEIC conversion has not been configured.");
  }
  const conversionForm = new FormData();
  conversionForm.append("File", photo, photo.name);
  conversionForm.append("StoreFile", "true");
  const conversionResponse = await fetch("https://v2.convertapi.com/convert/heic/to/jpg", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.HEIC_JPG_API_KEY}` },
    body: conversionForm,
  });
  if (!conversionResponse.ok) {
    throw new Error("Could not convert the HEIC photo. Please try a JPG or PNG instead.");
  }
  const conversion = await conversionResponse.json();
  const downloadUrl = conversion.Files?.[0]?.Url || conversion.Files?.[0]?.FileUrl;
  if (!downloadUrl) {
    throw new Error("The converted HEIC photo was unavailable. Please try a JPG or PNG instead.");
  }
  const imageResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${env.HEIC_JPG_API_KEY}` },
  });
  if (!imageResponse.ok) {
    throw new Error("Could not retrieve the converted HEIC photo. Please try again.");
  }
  return imageResponse.body;
}

export async function onRequestGet({ env }) {
  const { results } = await env.RECIPES_DB.prepare(
    `SELECT id, country, city, recipe_name, submitter_name, ingredients, instructions,
            latitude, longitude, photo_keys, created_at
       FROM recipes
       ORDER BY created_at DESC`,
  ).all();

  return json(
    results.map((recipe) => ({
      ...recipe,
      photoUrls: JSON.parse(recipe.photo_keys).map(photoUrl),
    })),
  );
}

export async function onRequestPost({ request, env }) {
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
  if (photos.length > MAX_PHOTOS || photos.some((photo) => photo.size > MAX_PHOTO_SIZE)) {
    return json({ error: "Add up to four image files, each no larger than 5 MB." }, { status: 400 });
  }
  if (photos.some((photo) => !DISPLAYABLE_IMAGE_TYPES.has(photo.type) && !HEIC_IMAGE_TYPES.has(photo.type))) {
    return json({ error: "Photos must be JPG, PNG, WebP, GIF, AVIF, HEIC, or HEIF files." }, { status: 400 });
  }

  const photoKeys = [];
  for (const photo of photos) {
    const isHeic = HEIC_IMAGE_TYPES.has(photo.type);
    const extension = isHeic ? "jpg" : photo.type.split("/")[1];
    const key = `${crypto.randomUUID()}.${extension}`;
    await env.RECIPE_IMAGES.put(key, isHeic ? await convertHeicToJpg(photo, env) : photo.stream(), {
      httpMetadata: { contentType: isHeic ? "image/jpeg" : photo.type },
    });
    photoKeys.push(key);
  }

  const id = crypto.randomUUID();
  await env.RECIPES_DB.prepare(
    `INSERT INTO recipes (
      id, country, city, recipe_name, submitter_name, ingredients, instructions,
      latitude, longitude, photo_keys
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      country,
      city,
      recipeName,
      submitterName,
      ingredients,
      instructions,
      latitude,
      longitude,
      JSON.stringify(photoKeys),
    )
    .run();

  return json({ id }, { status: 201 });
}
