import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";

const styleResponse = await fetch("https://demotiles.maplibre.org/style.json");
const style = await styleResponse.json();

style.layers = style.layers.filter(
  (layer) => layer.id !== "geolines" && layer.id !== "geolines-label",
);

const map = new maplibregl.Map({
  container: "map",
  style,
  center: [0, 20],
  zoom: 1.5,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

const form = document.querySelector("#recipe-form");
const status = document.querySelector("#form-status");
const pinInstruction = document.querySelector("#pin-instruction");
let selectedLocation;
let selectedMarker;
let recipeMarkers = [];

function createRecipePopup(recipe) {
  const content = document.createElement("article");
  content.className = "recipe-popup";

  const title = document.createElement("h2");
  title.textContent = recipe.recipe_name;
  content.append(title);

  for (const [label, value] of [
    ["Location", `${recipe.city}, ${recipe.country}`],
    ["Ingredients", recipe.ingredients],
    ["Instructions", recipe.instructions],
  ]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = `${label}: ${value}`;
    content.append(paragraph);
  }

  for (const photoUrl of recipe.photoUrls) {
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = recipe.recipe_name;
    content.append(image);
  }

  return new maplibregl.Popup({ offset: 20 }).setDOMContent(content);
}

async function loadRecipes() {
  const response = await fetch("/api/recipes");
  if (!response.ok) {
    throw new Error("Could not load recipes.");
  }

  const recipes = await response.json();
  recipeMarkers.forEach((marker) => marker.remove());
  recipeMarkers = recipes.map((recipe) =>
    new maplibregl.Marker()
      .setLngLat([recipe.longitude, recipe.latitude])
      .setPopup(createRecipePopup(recipe))
      .addTo(map),
  );
}

map.on("click", (event) => {
  selectedLocation = event.lngLat;
  selectedMarker?.remove();
  selectedMarker = new maplibregl.Marker({ color: "#d97706" })
    .setLngLat(selectedLocation)
    .addTo(map);
  pinInstruction.textContent = `Pin set: ${selectedLocation.lat.toFixed(3)}, ${selectedLocation.lng.toFixed(3)}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedLocation) {
    status.textContent = "Click the map to place the recipe pin first.";
    return;
  }

  const formData = new FormData(form);
  formData.append("latitude", selectedLocation.lat);
  formData.append("longitude", selectedLocation.lng);
  status.textContent = "Saving recipe…";

  try {
    const response = await fetch("/api/recipes", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not save recipe.");
    }

    form.reset();
    selectedMarker?.remove();
    selectedMarker = undefined;
    selectedLocation = undefined;
    pinInstruction.textContent = "Click the map to place this recipe's city pin.";
    status.textContent = "Recipe added.";
    await loadRecipes();
  } catch (error) {
    status.textContent = error.message;
  }
});

loadRecipes().catch((error) => {
  status.textContent = error.message;
});
