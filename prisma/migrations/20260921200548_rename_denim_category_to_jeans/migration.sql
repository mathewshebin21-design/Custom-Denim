-- "denim" was the internal id for the Jeans category. It's being renamed to
-- "jeans" to keep it clearly distinct from "denim_jackets" (added alongside
-- it) — every existing product filed under "denim" moves over so nothing
-- silently disappears from its category filter.
UPDATE "Product" SET category = 'jeans' WHERE category = 'denim';
