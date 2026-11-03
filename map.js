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
const locationInstruction = document.querySelector("#location-instruction");
const countryInput = document.querySelector("#country");
const cityInput = document.querySelector("#city");
const countryOptions = document.querySelector("#country-options");
const cityOptions = document.querySelector("#city-options");
let selectedLocation;
let selectedMarker;
let recipeMarkers = [];
let selectedCountry;
let countryResults = [];
let cityResults = [];
let countrySearchTimer;
let citySearchTimer;

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

function showSelectedCity(city) {
  selectedLocation = { lat: city.latitude, lng: city.longitude };
  selectedMarker?.remove();
  selectedMarker = new maplibregl.Marker({ color: "#d97706" })
    .setLngLat(selectedLocation)
    .addTo(map);
  map.flyTo({ center: selectedLocation, zoom: 5 });
  locationInstruction.textContent = `Location selected: ${city.city}, ${city.country}.`;
}

function fillOptions(element, results, field) {
  element.replaceChildren(
    ...results.map((result) => {
      const option = document.createElement("option");
      option.value = result[field];
      return option;
    }),
  );
}

async function searchLocations(kind, query, countryCode) {
  const parameters = new URLSearchParams({ kind, q: query });
  if (countryCode) parameters.set("country", countryCode);
  const response = await fetch(`/api/locations?${parameters}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not search locations.");
  return result;
}

countryInput.addEventListener("input", () => {
  selectedCountry = undefined;
  selectedLocation = undefined;
  cityInput.value = "";
  cityInput.disabled = true;
  cityOptions.replaceChildren();
  clearTimeout(countrySearchTimer);
  if (countryInput.value.trim().length < 2) return;

  countrySearchTimer = setTimeout(async () => {
    try {
      countryResults = await searchLocations("country", countryInput.value.trim());
      fillOptions(countryOptions, countryResults, "country");
    } catch (error) {
      status.textContent = error.message;
    }
  }, 250);
});

countryInput.addEventListener("change", () => {
  selectedCountry = countryResults.find(
    (country) => country.country === countryInput.value,
  );
  if (!selectedCountry) {
    status.textContent = "Choose a country from the suggested list.";
    cityInput.disabled = true;
    return;
  }
  status.textContent = "";
  cityInput.disabled = false;
  cityInput.focus();
  locationInstruction.textContent = `Country selected: ${selectedCountry.country}. Search for a city.`;
});

cityInput.addEventListener("input", () => {
  selectedLocation = undefined;
  selectedMarker?.remove();
  clearTimeout(citySearchTimer);
  if (!selectedCountry || cityInput.value.trim().length < 2) return;

  citySearchTimer = setTimeout(async () => {
    try {
      cityResults = await searchLocations(
        "city",
        cityInput.value.trim(),
        selectedCountry.countryCode,
      );
      fillOptions(cityOptions, cityResults, "city");
    } catch (error) {
      status.textContent = error.message;
    }
  }, 250);
});

cityInput.addEventListener("change", () => {
  const selectedCity = cityResults.find((city) => city.city === cityInput.value);
  if (!selectedCity) {
    status.textContent = "Choose a city from the suggested list.";
    return;
  }
  status.textContent = "";
  showSelectedCity(selectedCity);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedLocation) {
    status.textContent = "Choose a country and city from the suggested lists first.";
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
    selectedCountry = undefined;
    countryResults = [];
    cityResults = [];
    cityInput.disabled = true;
    countryOptions.replaceChildren();
    cityOptions.replaceChildren();
    locationInstruction.textContent = "Search for a country, then select a city.";
    status.textContent = "Recipe added.";
    await loadRecipes();
  } catch (error) {
    status.textContent = error.message;
  }
});

loadRecipes().catch((error) => {
  status.textContent = error.message;
});
