const STAGE_ORDER = [
  "artist_review",
  "base_preparation",
  "sketch",
  "painting",
  "detail_work",
  "quality_control",
  "packed",
  "shipped",
  "delivered",
];

const STAGE_LABELS: Record<string, string> = {
  artist_review: "Artist Review",
  base_preparation: "Base Preparation",
  sketch: "Sketch",
  painting: "Painting",
  detail_work: "Detail Work",
  quality_control: "Quality Control",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function ProductionTimeline({ reachedStages }: { reachedStages: string[] }) {
  const reachedSet = new Set(reachedStages);
  const lastReachedIndex = STAGE_ORDER.reduce(
    (acc, stage, i) => (reachedSet.has(stage) ? i : acc),
    -1,
  );

  return (
    <ol className="grid gap-px bg-line sm:grid-cols-3 md:grid-cols-9">
      {STAGE_ORDER.map((stage, i) => {
        const reached = i <= lastReachedIndex;
        const current = i === lastReachedIndex;
        return (
          <li
            key={stage}
            className={`bg-paper p-3 text-center text-xs ${reached ? "text-ink" : "text-ink/30"}`}
          >
            <div
              className={`mx-auto mb-2 h-2 w-2 rounded-full ${
                current ? "bg-rust" : reached ? "bg-ink" : "bg-line"
              }`}
            />
            {STAGE_LABELS[stage]}
          </li>
        );
      })}
    </ol>
  );
}
