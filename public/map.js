import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";

const MINIMUM_MAP_ZOOM = 1.6;
const REGION_LABEL_ZOOM = 3;
const PIN_GROUP_DISTANCE = 36;
const DEFAULT_PIN_WIDTH = 27;
const MAX_PIN_OVERLAP = 0.6;
const PIN_SEPARATION = DEFAULT_PIN_WIDTH * (1 - MAX_PIN_OVERLAP);
const styleResponse = await fetch("https://demotiles.maplibre.org/style.json");
const style = await styleResponse.json();
const HIDDEN_LAYERS = new Set([
  "crimea-fill",
  "geolines",
  "geolines-label",
]);
style.layers = style.layers
  .filter((layer) => !HIDDEN_LAYERS.has(layer.id))
  .map((layer) => {
    if (layer.id === "countries-fill") {
      return { ...layer, paint: { ...layer.paint, "fill-color": "#c8e6a0" } };
    }
    if (layer.id === "countries-boundary") {
      return { ...layer, paint: { ...layer.paint, "line-color": "rgb(148, 183, 132)" } };
    }
    if (layer.id === "coastline") {
      return { ...layer, paint: { ...layer.paint, "line-color": "rgba(255, 255, 255, 0)" } };
    }
    if (layer.id === "countries-label") {
      return {
        ...layer,
        minzoom: REGION_LABEL_ZOOM,
        layout: {
  ...layer.layout,
  "text-field": [
    "case",
    ["==", ["get", "NAME"], "China"],
    "Mainland China",
    ["get", "NAME"]
  ],
  visibility: "none"
},
      };
    }
    return layer;
  });

const map = new maplibregl.Map({
  container: "map",
  style,
  center: [0, 20],
  zoom: MINIMUM_MAP_ZOOM,
  minZoom: MINIMUM_MAP_ZOOM,
});
map.addControl(new maplibregl.NavigationControl(), "top-right");

let regionLabelsVisible = false;
function updateRegionLabelVisibility() {
  const shouldShow = map.getZoom() >= REGION_LABEL_ZOOM;
  if (shouldShow === regionLabelsVisible) return;
  regionLabelsVisible = shouldShow;
  map.setLayoutProperty("countries-label", "visibility", shouldShow ? "visible" : "none");
}
map.on("load", updateRegionLabelVisibility);
map.on("zoom", updateRegionLabelVisibility);

const form = document.querySelector("#recipe-form");
const status = document.querySelector("#form-status");
const entryPanel = document.querySelector(".entry-panel");
const mapViewButton = document.querySelector("#map-view-button");
const addRecipeButton = document.querySelector("#add-recipe-button");
const countryInput = document.querySelector("#country");
const cityInput = document.querySelector("#city");
const countryOptions = document.querySelector("#country-options");
const cityOptions = document.querySelector("#city-options");
const recipeOverlay = document.querySelector("#recipe-overlay");
const closeRecipeView = document.querySelector("#close-recipe-view");
const recipeViewTitle = document.querySelector("#recipe-view-title");
const recipeViewLocation = document.querySelector("#recipe-view-location");
const recipeViewSubmitter = document.querySelector("#recipe-view-submitter");
const recipeViewPhotos = document.querySelector("#recipe-view-photos");
const recipeViewIngredients = document.querySelector("#recipe-view-ingredients");
const recipeViewInstructions = document.querySelector("#recipe-view-instructions");
let selectedLocation;
let selectedMarker;
let recipeMarkers = [];
let selectedCountry;
let countrySearchTimer;
let citySearchTimer;
let lastFocusedElement;

function showMapView() {
  entryPanel.classList.remove("is-open");
  entryPanel.setAttribute("aria-hidden", "true");
  mapViewButton.classList.add("is-active");
  mapViewButton.setAttribute("aria-pressed", "true");
  addRecipeButton.classList.remove("is-active");
  addRecipeButton.setAttribute("aria-pressed", "false");
  if (recipeOverlay.classList.contains("is-open")) closeRecipeOverlay();
}

function showAddRecipePanel() {
  entryPanel.classList.add("is-open");
  entryPanel.setAttribute("aria-hidden", "false");
  mapViewButton.classList.remove("is-active");
  mapViewButton.setAttribute("aria-pressed", "false");
  addRecipeButton.classList.add("is-active");
  addRecipeButton.setAttribute("aria-pressed", "true");
  countryInput.focus();
}

async function readJson(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("The server returned an HTML error page. Run the site with \"npx wrangler dev\" locally, or confirm the deployed Worker is serving this site.");
  }
}

function openRecipeView(recipe) {
  lastFocusedElement = document.activeElement;
  recipeViewTitle.textContent = recipe.recipe_name;
  recipeViewLocation.textContent = `${recipe.city}, ${recipe.country}`;
  recipeViewIngredients.textContent = recipe.ingredients;
  recipeViewInstructions.textContent = recipe.instructions;
  recipeViewSubmitter.hidden = !recipe.submitter_name;
  recipeViewSubmitter.textContent = recipe.submitter_name ? `Submitted by: ${recipe.submitter_name}` : "";
  recipeViewPhotos.replaceChildren();
  if (recipe.photoUrls.length === 0) {
    const note = document.createElement("p");
    note.textContent = "No photos were added.";
    recipeViewPhotos.append(note);
  } else {
    for (const photoUrl of recipe.photoUrls) {
      const image = document.createElement("img");
      image.src = photoUrl;
      image.alt = recipe.recipe_name;
      recipeViewPhotos.append(image);
    }
  }
  recipeOverlay.classList.add("is-open");
  recipeOverlay.setAttribute("aria-hidden", "false");
  closeRecipeView.focus();
}

function closeRecipeOverlay() {
  recipeOverlay.classList.remove("is-open");
  recipeOverlay.setAttribute("aria-hidden", "true");
  lastFocusedElement?.focus?.();
}

function spreadOverlappingPins(recipes) {
  const worldSize = 512 * (2 ** MINIMUM_MAP_ZOOM);
  const groups = [];
  for (const recipe of recipes) {
    const longitude = Number(recipe.longitude);
    const latitude = Math.max(-85.051129, Math.min(85.051129, Number(recipe.latitude)));
    const x = ((longitude + 180) / 360) * worldSize;
    const y = ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) * worldSize;
    const point = { recipe, x, y };
    let group = groups.find((candidate) => candidate.some((other) => (
      Math.hypot(point.x - other.x, point.y - other.y) < PIN_GROUP_DISTANCE
    )));
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(point);
  }

  return groups.flatMap((group) => group.map(({ recipe }, index) => {
    if (group.length === 1) return { recipe, offset: [0, 0] };
    const columns = Math.ceil(Math.sqrt(group.length));
    const rows = Math.ceil(group.length / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      recipe,
      offset: [
        (column - (columns - 1) / 2) * PIN_SEPARATION,
        (row - (rows - 1) / 2) * PIN_SEPARATION,
      ],
    };
  }));
}

async function loadRecipes() {
  const response = await fetch("/api/recipes");
  if (!response.ok) throw new Error("Could not load recipes.");
  const recipes = await readJson(response);
  recipeMarkers.forEach((marker) => marker.remove());
  recipeMarkers = spreadOverlappingPins(recipes).map(({ recipe, offset }) => {
    const marker = new maplibregl.Marker({ anchor: "bottom", offset })
      .setLngLat([recipe.longitude, recipe.latitude])
      .addTo(map);
    marker.getElement().setAttribute("aria-label", `View ${recipe.recipe_name}`);
    marker.getElement().addEventListener("click", () => openRecipeView(recipe));
    return marker;
  });
}

closeRecipeView.addEventListener("click", closeRecipeOverlay);
recipeOverlay.addEventListener("click", (event) => {
  if (event.target === recipeOverlay) closeRecipeOverlay();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && recipeOverlay.classList.contains("is-open")) closeRecipeOverlay();
});
mapViewButton.addEventListener("click", showMapView);
addRecipeButton.addEventListener("click", showAddRecipePanel);

function hideOptions(input, options) {
  options.hidden = true;
  options.replaceChildren();
  input.setAttribute("aria-expanded", "false");
}

function showOptions(input, options, results, label, choose) {
  options.replaceChildren(...results.map((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-option";
    button.setAttribute("role", "option");
    button.textContent = label(result);
    button.addEventListener("click", () => choose(result));
    return button;
  }));
  options.hidden = results.length === 0;
  input.setAttribute("aria-expanded", String(results.length > 0));
}

async function searchLocations(kind, query, countryCode) {
  const parameters = new URLSearchParams({ kind, q: query });
  if (countryCode) parameters.set("country", countryCode);
  const response = await fetch(`/api/locations?${parameters}`);
  const result = await readJson(response);
  if (!response.ok) throw new Error(result.error || "Could not search locations.");
  return result;
}

function showSelectedCity(city) {
  selectedLocation = { lat: city.latitude, lng: city.longitude };
  selectedMarker?.remove();
  selectedMarker = new maplibregl.Marker({ anchor: "bottom", color: "#d97706" }).setLngLat(selectedLocation).addTo(map);
  map.flyTo({ center: selectedLocation, zoom: 5 });
}

function chooseCountry(country) {
  selectedCountry = country;
  countryInput.value = country.country;
  cityInput.value = "";
  cityInput.disabled = false;
  selectedLocation = undefined;
  selectedMarker?.remove();
  hideOptions(countryInput, countryOptions);
  hideOptions(cityInput, cityOptions);
  status.textContent = "";
  cityInput.focus();
}

function chooseCity(city) {
  cityInput.value = city.city;
  hideOptions(cityInput, cityOptions);
  status.textContent = "";
  showSelectedCity(city);
}

countryInput.addEventListener("input", () => {
  selectedCountry = undefined;
  selectedLocation = undefined;
  selectedMarker?.remove();
  cityInput.value = "";
  cityInput.disabled = true;
  hideOptions(cityInput, cityOptions);
  clearTimeout(countrySearchTimer);
  const query = countryInput.value.trim();
  if (query.length < 2) {
    hideOptions(countryInput, countryOptions);
    return;
  }
  countrySearchTimer = setTimeout(async () => {
    try {
      const results = await searchLocations("country", query);
      showOptions(countryInput, countryOptions, results, (country) => country.country, chooseCountry);
    } catch (error) { status.textContent = error.message; }
  }, 200);
});

cityInput.addEventListener("input", () => {
  selectedLocation = undefined;
  selectedMarker?.remove();
  clearTimeout(citySearchTimer);
  const query = cityInput.value.trim();
  if (!selectedCountry || query.length < 2) {
    hideOptions(cityInput, cityOptions);
    return;
  }
  citySearchTimer = setTimeout(async () => {
    try {
      const results = await searchLocations("city", query, selectedCountry.countryCode);
      showOptions(cityInput, cityOptions, results, (city) => city.region ? `${city.city}, ${city.region}` : city.city, chooseCity);
    } catch (error) { status.textContent = error.message; }
  }, 200);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".location-search")) {
    hideOptions(countryInput, countryOptions);
    hideOptions(cityInput, cityOptions);
  }
});

for (const [input, options] of [[countryInput, countryOptions], [cityInput, cityOptions]]) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideOptions(input, options);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedCountry || !selectedLocation) {
    status.textContent = "Choose a country and city from the suggested lists first.";
    return;
  }
  const formData = new FormData(form);
  formData.append("latitude", selectedLocation.lat);
  formData.append("longitude", selectedLocation.lng);
  status.textContent = "Saving recipe…";
  try {
    const response = await fetch("/api/recipes", { method: "POST", body: formData });
    const result = await readJson(response);
    if (!response.ok) throw new Error(result.error || "Could not save recipe.");
    form.reset();
    selectedMarker?.remove();
    selectedMarker = undefined;
    selectedLocation = undefined;
    selectedCountry = undefined;
    cityInput.disabled = true;
    hideOptions(countryInput, countryOptions);
    hideOptions(cityInput, cityOptions);
    status.textContent = "Recipe added.";
    await loadRecipes();
  } catch (error) { status.textContent = error.message; }
});

loadRecipes().catch((error) => { status.textContent = error.message; });
