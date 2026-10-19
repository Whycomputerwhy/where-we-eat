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
