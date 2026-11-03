import {
  onRequestGet as listRecipes,
  onRequestPost as createRecipe,
} from "./functions/api/recipes.js";
import { onRequestGet as getImage } from "./functions/api/images/[key].js";
import { onRequestGet as searchLocations } from "./functions/api/locations.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/recipes") {
      if (request.method === "GET") return listRecipes({ env });
      if (request.method === "POST") return createRecipe({ request, env });
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/locations") {
      if (request.method === "GET") return searchLocations({ request, env });
      return new Response("Method not allowed", { status: 405 });
    }

    const imageMatch = url.pathname.match(/^\/api\/images\/([^/]+)$/);
    if (request.method === "GET" && imageMatch) {
      return getImage({
        params: { key: decodeURIComponent(imageMatch[1]) },
        env,
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
