import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { generateConceptImage } from "../src/lib/ai/imageGeneration";

/**
 * Production safety guard. This script inserts demo data — a demo admin
 * account, demo artists, and a sample commission — all with a known,
 * shared password. It must never be able to run against a production
 * database.
 *
 * `APP_ENV` is the intended long-term environment discriminator (see the
 * C0 architecture plan's central env-config item, not yet implemented).
 * Until that lands, this guard reads `process.env.APP_ENV` directly. It
 * fails closed: only an explicit, recognized "development" or "staging"
 * value allows the seed to run. A missing or unrecognized value is
 * refused exactly like "production" — this is deliberate, not an
 * oversight, so a misconfigured deployment can never fall through to
 * "allowed" by default.
 */
const SEED_ALLOWED_ENVIRONMENTS = new Set(["development", "staging"]);

function assertSeedAllowed(): void {
  const appEnv = process.env.APP_ENV;

  if (appEnv === "production") {
    console.error(
      "Refusing to seed: APP_ENV=production. This script inserts demo data " +
        "(a demo admin, demo artists, and a sample commission, all with a " +
        "known password) and must never run against a production database.",
    );
    process.exit(1);
  }

  if (!appEnv || !SEED_ALLOWED_ENVIRONMENTS.has(appEnv)) {
    console.error(
      appEnv
        ? `Refusing to seed: APP_ENV is set to an unrecognized value ("${appEnv}").`
        : "Refusing to seed: APP_ENV is not set.",
    );
    console.error(
      'Set APP_ENV to "development" or "staging" to run this seed. ' +
        "This guard fails closed: an unset or unrecognized APP_ENV is " +
        "refused exactly like production, so it can never be run by " +
        "accident in an environment that forgot to configure it.",
    );
    process.exit(1);
  }
}

assertSeedAllowed();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Refusing to seed: DATABASE_URL is not set.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("Seeding garments...");
  const garments = [
    {
      type: "jacket",
      label: "Denim Jacket",
      description: "Classic trucker silhouette, the studio's signature canvas for full back-panel artwork.",
      basePriceCents: 42000,
      imageUrl: "/jackets/denim-jacket-joker-back.webp",
    },
    {
      type: "jeans",
      label: "Jeans",
      description: "Straight or tapered fit, hand-painted or embroidered along the leg seam and pockets.",
      basePriceCents: 32000,
    },
    {
      type: "vest",
      label: "Denim Vest",
      description: "Sleeveless canvas built for patchwork, embroidery, and layered pin-and-patch storytelling.",
      basePriceCents: 28000,
    },
    {
      type: "sneakers",
      label: "Sneakers",
      description: "Hand-painted canvas sneakers, ideal for smaller, detailed motifs.",
      basePriceCents: 21000,
    },
  ];

  for (const g of garments) {
    const existing = await db.garment.findFirst({ where: { type: g.type } });
    if (!existing) {
      await db.garment.create({ data: g });
    } else if (!existing.imageUrl && g.imageUrl) {
      // Backfills a photo onto a garment row seeded before real product
      // photography existed — never overwrites an admin-set imageUrl.
      await db.garment.update({ where: { id: existing.id }, data: { imageUrl: g.imageUrl } });
    }
  }

  console.log("Seeding admin user...");
  const adminEmail = "admin@easewear.studio";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Studio Admin",
        role: "admin",
        passwordHash: await hash("ChangeMe123!"),
      },
    });
  }

  console.log("Seeding demo artists...");
  const artistSeeds = [
    {
      email: "maya@easewear.studio",
      name: "Maya Ortega",
      bio: "Hand-embroidery and textile collage artist, known for archival, memory-driven pieces.",
      styleTags: ["memory", "archive", "embroidery", "texture", "botanical"],
    },
    {
      email: "theo@easewear.studio",
      name: "Theo Nakamura",
      bio: "Painter working in high-contrast, cinematic compositions across denim and canvas.",
      styleTags: ["noir", "cinematic", "contrast", "silhouette", "portrait"],
    },
    {
      email: "priya@easewear.studio",
      name: "Priya Shah",
      bio: "Mural and graffiti-trained painter bringing raw, energetic mark-making to wearable pieces.",
      styleTags: ["street art", "texture", "spontaneity", "color", "abstract"],
    },
  ];

  for (const a of artistSeeds) {
    const existing = await db.user.findUnique({ where: { email: a.email } });
    if (!existing) {
      await db.user.create({
        data: {
          email: a.email,
          name: a.name,
          role: "artist",
          passwordHash: await hash("ChangeMe123!"),
          artist: {
            create: {
              name: a.name,
              bio: a.bio,
              styleTagsJson: JSON.stringify(a.styleTags),
              capacityStatus: "available",
            },
          },
        },
      });
    }
  }

  console.log("Seeding a completed demo commission (so the gallery isn't empty)...");
  const demoEmail = "demo.customer@easewear.studio";
  const existingDemoCommission = await db.commission.findFirst({ where: { customer: { email: demoEmail } } });
  if (!existingDemoCommission) {
    const jacket = await db.garment.findFirstOrThrow({ where: { type: "jacket" } });
    // Looked up by the seeded artist's stable email, not by display name —
    // `name` is not unique (this bit a manual DB cleanup during a rebrand:
    // two "Priya Shah" artist rows briefly coexisted under old/new email
    // domains, and findFirst-by-name silently picked the wrong one).
    const priyaUser = await db.user.findUniqueOrThrow({
      where: { email: "priya@easewear.studio" },
      include: { artist: true },
    });
    const priya = priyaUser.artist!;

    const demoCustomer = await db.user.upsert({
      where: { email: demoEmail },
      create: {
        email: demoEmail,
        name: "Jordan Ellis",
        role: "customer",
        passwordHash: await hash("ChangeMe123!"),
        customerProfile: { create: {} },
      },
      update: {},
    });

    const storyText =
      "I spent every summer of my childhood on my uncle's fishing boat off the Gulf Coast. This jacket is for the smell of salt water, the sound of the engine, and the horizon line that never changed.";
    const themes = ["the sea", "fishing", "horizon", "salt air"];
    const colors = ["denim blue", "rust", "bone white"];
    const direction = {
      title: "RAW STREET ART",
      narrative:
        "An energetic, hand-painted treatment with visible brushwork and layered mark-making — the horizon line rendered as a raw, textured stripe across the back, closer to a mural than a portrait.",
      colorPalette: colors,
      themes,
      placement: "full back panel",
    };

    const designSpec = {
      silhouetteNotes: "Interpretation of \"RAW STREET ART\" applied to a classic trucker jacket.",
      motifs: themes,
      placementDetail: direction.placement,
      colorNotes: colors.join(", "),
      materialNotes: "Hand-painted acrylic textile medium with reinforced stitching at the collar and cuffs.",
      requiredElements: ["horizon line motif", "visible brushwork texture"],
      elementsToAvoid: ["literal photographic reproduction of a specific boat"],
    };

    const feasibility = {
      summary: "Advisory notes pending artist review — no automated feasibility check was run.",
      considerations: ["Placement and scale should be confirmed against the physical garment during Artist Review."],
      suggestedAdjustments: [],
    };

    const imageUrl = await generateConceptImage({
      title: direction.title,
      narrative: direction.narrative,
      colorPalette: direction.colorPalette,
      themes: direction.themes,
      placement: direction.placement,
      garmentLabel: jacket.label,
      versionSeed: "demo-seed-v1",
    });

    const commission = await db.commission.create({
      data: {
        customerId: demoCustomer.id,
        garmentId: jacket.id,
        status: "completed",
        storyText,
        themesJson: JSON.stringify(themes),
        colorsJson: JSON.stringify(colors),
        placement: direction.placement,
        budgetTierCents: 45000,
        concepts: {
          create: {
            creativeDirections: {
              create: {
                title: direction.title,
                narrative: direction.narrative,
                placement: direction.placement,
                colorPalette: JSON.stringify(direction.colorPalette),
                themesJson: JSON.stringify(direction.themes),
                isSelected: true,
              },
            },
          },
        },
      },
      include: { concepts: { include: { creativeDirections: true } } },
    });

    const creativeDirection = commission.concepts[0].creativeDirections[0];

    const version = await db.conceptVersion.create({
      data: {
        conceptId: commission.concepts[0].id,
        creativeDirectionId: creativeDirection.id,
        versionNumber: 1,
        designSpecJson: JSON.stringify(designSpec),
        imageUrl,
        feasibilityNotes: JSON.stringify(feasibility),
        status: "approved",
      },
    });

    await db.concept.update({ where: { id: commission.concepts[0].id }, data: { currentVersionId: version.id } });

    await db.artistAssignment.create({
      data: { commissionId: commission.id, artistId: priya.id, status: "completed" },
    });

    const stages = [
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
    for (const stage of stages) {
      await db.productionStage.create({ data: { commissionId: commission.id, stage, exitedAt: new Date() } });
    }
    await db.productionUpdate.create({
      data: {
        commissionId: commission.id,
        stage: "painting",
        message: "First pass of the horizon line is in — warm rust tones layered over the base denim blue.",
      },
    });

    const artwork = await db.artwork.create({
      data: {
        commissionId: commission.id,
        approvedVersionId: version.id,
        materials: "Cotton denim, acrylic textile paint, reinforced stitching",
        finalDescription: "A hand-painted tribute to a childhood spent on the water, rendered as a raw, textured horizon across the back panel.",
        completedAt: new Date(),
      },
    });

    const order = await db.order.create({ data: { commissionId: commission.id, priceCents: 45000, status: "paid" } });
    await db.payment.create({ data: { orderId: order.id, amountCents: 45000, status: "succeeded", paidAt: new Date() } });
    await db.shipment.create({
      data: { orderId: order.id, carrier: "UPS", trackingNumber: "1Z999AA10123456784", shippedAt: new Date(), deliveredAt: new Date() },
    });

    const publicSlug = "raw-street-art-demo";
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const qrCodeDataUrl = await QRCode.toDataURL(`${baseUrl}/passport/${publicSlug}`);
    await db.artPassport.create({
      data: {
        artworkId: artwork.id,
        pieceId: "CD-2026-0001",
        publicSlug,
        qrCodeDataUrl,
        careInstructions: "Spot clean only. Do not machine wash or dry.",
        authenticityStatement:
          "This piece is one-of-one: AI-designed with a human artist, hand-made once, and will never be reproduced.",
        publishedAt: new Date(),
      },
    });
  }

  console.log("Seeding retail shop products...");
  // Real starting catalog from Ease Wear's current surplus/thrifted stock
  // sheet (Sept 2026), not fictional demo data like the rows above.
  // Quantities weren't given per-SKU on that sheet ("message us for live
  // photos, colours and sizes") — seeded at a conservative placeholder of 5
  // each; adjust real on-hand counts at /admin/shop before going live.
  // Prices are in INR, matching the sheet.
  const retailProductSeeds = [
    { title: "Snitch Shirts", category: "shirts", brand: "Snitch", description: "Contemporary shirts for sharp casual looks.", priceCents: 118500, source: "surplus_branded" },
    { title: "U.S. Polo Half Shirts", category: "shirts", brand: "U.S. Polo Assn.", description: "Half-sleeve shirts with classic everyday styling.", priceCents: 135000, source: "surplus_branded" },
    { title: "Pepe Shirts", category: "shirts", brand: "Pepe Jeans", description: "Versatile shirts for casual and smart-casual wear.", priceCents: 147000, source: "surplus_branded" },
    { title: "Armani Exchange T-Shirts", category: "t_shirts", brand: "Armani Exchange", description: "Clean casual T-shirts with contemporary styling.", priceCents: 97500, source: "surplus_branded" },
    { title: "Flying Machine Round", category: "t_shirts", brand: "Flying Machine", description: "Casual round-neck options with a youthful feel.", priceCents: 52500, source: "surplus_branded" },
    { title: "Souled Store Drop Shoulder", category: "t_shirts", brand: "The Souled Store", description: "Relaxed drop-shoulder silhouettes for streetwear looks.", priceCents: 112500, source: "surplus_branded" },
    { title: "Jack & Jones Jeans", category: "denim", brand: "Jack & Jones", description: "Everyday denim with modern styling.", priceCents: 172500, source: "surplus_branded" },
    { title: "Blackberrys Jeans", category: "denim", brand: "Blackberrys", description: "Smart denim for polished casual dressing.", priceCents: 177000, source: "surplus_branded" },
    { title: "Souled Store Gen-Z Jeans", category: "denim", brand: "The Souled Store", description: "Trend-led denim for relaxed contemporary outfits.", priceCents: 217500, source: "surplus_branded" },
    { title: "G-Star Slim Fit Cargos", category: "cargos", brand: "G-Star RAW", description: "Utility-inspired slim cargos for everyday street style.", priceCents: 208500, source: "surplus_branded" },
    { title: "Rare Rabbit Chinos", category: "cargos", brand: "Rare Rabbit", description: "Clean chinos suited to smart-casual occasions.", priceCents: 225000, source: "surplus_branded" },
    { title: "Souled Store Shoes", category: "shoes", brand: "The Souled Store", description: "Statement casual footwear to complete the look.", priceCents: 255000, source: "surplus_branded" },
    { title: "HRX Tracksuits", category: "activewear", brand: "HRX", description: "Sport-inspired matching sets for movement and comfort.", priceCents: 217500, source: "surplus_branded" },
    { title: "Thrifted Jackets", category: "jackets", brand: null, description: "Handpicked pre-loved imported jackets. Each piece is unique.", priceCents: 49900, source: "thrifted_imported" },
  ];

  for (const p of retailProductSeeds) {
    const slug = p.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const existing = await db.product.findUnique({ where: { slug } });
    if (!existing) {
      await db.product.create({
        data: { ...p, slug, condition: "good", currency: "inr", quantity: 5 },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
