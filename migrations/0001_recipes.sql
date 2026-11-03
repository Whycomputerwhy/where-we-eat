CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  recipe_name TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  photo_keys TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
