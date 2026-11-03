# Where We Eat

Minimal map-based recipe prototype. Search for a country and city, add a recipe,
and click a saved marker to view it. It deploys as a Cloudflare Worker with static
assets. `public/` holds browser files and `src/worker.js` holds server code.

## Cloudflare setup

The repository already declares the provided resources in `wrangler.toml`:

- D1 binding: `RECIPES_DB`
- R2 binding: `RECIPE_IMAGES`

Before the first deployment, create the recipe table with:

```sh
npx wrangler d1 execute where-we-eat-recipe-submissions --remote --file=migrations/0001_recipes.sql
```

Country and city search uses MapTiler's geocoding API. Add a MapTiler API key as
a Cloudflare Worker secret (never place it in the website files):

```sh
npx wrangler secret put MAPTILER_API_KEY
```

For the Git-connected Cloudflare project, use `exit 0` as its Build command and
`npx wrangler deploy` as its Deploy command. The Worker routes `/api/*` requests
to the recipe code and serves all other files as static website assets.

meow meow
