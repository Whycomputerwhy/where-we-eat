const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

function json(data, options = {}) {
  return Response.json(data, options);
}

function photoUrl(key) {
  return `/api/images/${encodeURIComponent(key)}`;
}

export async function onRequestGet({ env }) {
  const { results } = await env.RECIPES_DB.prepare(
    `SELECT id, country, city, recipe_name, ingredients, instructions,
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
      httpMetadata: { contentType: photo.type },
    });
    photoKeys.push(key);
  }

  const id = crypto.randomUUID();
  await env.RECIPES_DB.prepare(
    `INSERT INTO recipes (
      id, country, city, recipe_name, ingredients, instructions,
      latitude, longitude, photo_keys
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      country,
      city,
      recipeName,
      ingredients,
      instructions,
      latitude,
      longitude,
      JSON.stringify(photoKeys),
    )
    .run();

  return json({ id }, { status: 201 });
}
