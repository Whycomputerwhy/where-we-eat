import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";

const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [0, 20],
  zoom: 1.5,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");
