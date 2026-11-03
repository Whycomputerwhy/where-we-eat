# Where We Eat

Minimal map-based recipe prototype. Click the map to set a city pin, add a recipe,
and click a saved marker to view it.

## Cloudflare setup

The repository already declares the provided resources in `wrangler.toml`:

- D1 binding: `RECIPES_DB`
- R2 binding: `RECIPE_IMAGES`

Before the first deployment, create the recipe table with:

```sh
npx wrangler d1 execute where-we-eat-recipe-submissions --remote --file=migrations/0001_recipes.sql
```

Deploy this repository to Cloudflare Pages. The Pages Functions in `functions/api/`
handle listing recipes, accepting entries and images, and serving images from R2.
