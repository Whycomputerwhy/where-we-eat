import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";

const styleResponse = await fetch("https://demotiles.maplibre.org/style.json");
const style = await styleResponse.json();
style.layers = style.layers.filter((layer) => layer.id !== "geolines" && layer.id !== "geolines-label");

const map = new maplibregl.Map({ container: "map", style, center: [0, 20], zoom: 1.5 });
map.addControl(new maplibregl.NavigationControl(), "top-right");

const form = document.querySelector("#recipe-form");
const status = document.querySelector("#form-status");
const locationInstruction = document.querySelector("#location-instruction");
const countryInput = document.querySelector("#country");
const cityInput = document.querySelector("#city");
const countryOptions = document.querySelector("#country-options");
const cityOptions = document.querySelector("#city-options");
let selectedLocation;
let selectedMarker;
let recipeMarkers = [];
let selectedCountry;
let countrySearchTimer;
let citySearchTimer;

function createRecipePopup(recipe) {
  const content = document.createElement("article");
  content.className = "recipe-popup";
  const title = document.createElement("h2");
  title.textContent = recipe.recipe_name;
  content.append(title);
  if (recipe.submitter_name) {
    const submitter = document.createElement("p");
    submitter.textContent = `Submitted by: ${recipe.submitter_name}`;
    content.append(submitter);
  }
  for (const [label, value] of [["Location", `${recipe.city}, ${recipe.country}`], ["Ingredients", recipe.ingredients], ["Instructions", recipe.instructions]]) {
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
  if (!response.ok) throw new Error("Could not load recipes.");
  const recipes = await response.json();
  recipeMarkers.forEach((marker) => marker.remove());
  recipeMarkers = recipes.map((recipe) => new maplibregl.Marker().setLngLat([recipe.longitude, recipe.latitude]).setPopup(createRecipePopup(recipe)).addTo(map));
}

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
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not search locations.");
  return result;
}

function showSelectedCity(city) {
  selectedLocation = { lat: city.latitude, lng: city.longitude };
  selectedMarker?.remove();
  selectedMarker = new maplibregl.Marker({ color: "#d97706" }).setLngLat(selectedLocation).addTo(map);
  map.flyTo({ center: selectedLocation, zoom: 5 });
  locationInstruction.textContent = `Location selected: ${city.city}, ${selectedCountry.country}.`;
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
  locationInstruction.textContent = `Country selected: ${country.country}. Search for a city.`;
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
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save recipe.");
    form.reset();
    selectedMarker?.remove();
    selectedMarker = undefined;
    selectedLocation = undefined;
    selectedCountry = undefined;
    cityInput.disabled = true;
    hideOptions(countryInput, countryOptions);
    hideOptions(cityInput, cityOptions);
    locationInstruction.textContent = "Search for a country, then select a city.";
    status.textContent = "Recipe added.";
    await loadRecipes();
  } catch (error) { status.textContent = error.message; }
});

loadRecipes().catch((error) => { status.textContent = error.message; });
