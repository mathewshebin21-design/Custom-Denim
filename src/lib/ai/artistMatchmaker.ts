import "server-only";
import { db } from "@/lib/db";

/**
 * Heuristic artist matching by style-tag overlap with the concept's themes,
 * filtered to artists with open capacity. This is deliberately simple for
 * MVP — a real matchmaker would weigh workload, past work quality, and
 * artist preference, and could itself become an AI-assisted service later.
 */
export async function suggestArtists(themes: string[], limit = 3) {
  const artists = await db.artist.findMany({
    where: { capacityStatus: { in: ["available", "limited"] } },
  });

  const normalizedThemes = themes.map((t) => t.toLowerCase());

  const scored = artists.map((artist) => {
    const styleTags: string[] = JSON.parse(artist.styleTagsJson || "[]");
    const overlap = styleTags.filter((tag) =>
      normalizedThemes.some((theme) => theme.includes(tag.toLowerCase()) || tag.toLowerCase().includes(theme)),
    ).length;
    return { artist, score: overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.artist);
}
