import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { generateConceptImage } from "../src/lib/ai/visualConceptGenerator";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
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
    }
  }

  console.log("Seeding admin user...");
  const adminEmail = "admin@customdenim.studio";
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
      email: "maya@customdenim.studio",
      name: "Maya Ortega",
      bio: "Hand-embroidery and textile collage artist, known for archival, memory-driven pieces.",
      styleTags: ["memory", "archive", "embroidery", "texture", "botanical"],
    },
    {
      email: "theo@customdenim.studio",
      name: "Theo Nakamura",
      bio: "Painter working in high-contrast, cinematic compositions across denim and canvas.",
      styleTags: ["noir", "cinematic", "contrast", "silhouette", "portrait"],
    },
    {
      email: "priya@customdenim.studio",
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
  const demoEmail = "demo.customer@customdenim.studio";
  const existingDemoCommission = await db.commission.findFirst({ where: { customer: { email: demoEmail } } });
  if (!existingDemoCommission) {
    const jacket = await db.garment.findFirstOrThrow({ where: { type: "jacket" } });
    const priya = await db.artist.findFirstOrThrow({ where: { name: "Priya Shah" } });

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

    const imageUrl = generateConceptImage({
      title: direction.title,
      colorPalette: direction.colorPalette,
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
