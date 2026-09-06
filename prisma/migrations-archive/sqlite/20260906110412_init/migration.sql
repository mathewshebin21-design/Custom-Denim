-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "shippingAddress" TEXT,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Garment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'intake',
    "storyText" TEXT NOT NULL,
    "aestheticText" TEXT,
    "themesJson" TEXT NOT NULL DEFAULT '[]',
    "colorsJson" TEXT NOT NULL DEFAULT '[]',
    "placement" TEXT,
    "occasion" TEXT,
    "budgetTierCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Commission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Commission_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferenceImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceImage_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Concept_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeDirection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "colorPalette" TEXT NOT NULL,
    "themesJson" TEXT NOT NULL,
    "placement" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeDirection_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConceptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "creativeDirectionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "designSpecJson" TEXT NOT NULL,
    "imageUrl" TEXT,
    "aiRationale" TEXT,
    "customerFeedback" TEXT,
    "feasibilityNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptVersion_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConceptVersion_creativeDirectionId_fkey" FOREIGN KEY ("creativeDirectionId") REFERENCES "CreativeDirection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "styleTagsJson" TEXT NOT NULL DEFAULT '[]',
    "portfolioJson" TEXT NOT NULL DEFAULT '[]',
    "capacityStatus" TEXT NOT NULL DEFAULT 'available',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtistAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtistAssignment_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistAssignment_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "ProductionStage_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "photoUrl" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionUpdate_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "approvedVersionId" TEXT NOT NULL,
    "materials" TEXT,
    "finalDescription" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artwork_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Artwork_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "ConceptVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtPassport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artworkId" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "qrCodeDataUrl" TEXT,
    "careInstructions" TEXT,
    "authenticityStatement" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtPassport_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_userId_key" ON "Artist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistAssignment_commissionId_key" ON "ArtistAssignment"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_commissionId_key" ON "Artwork"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_approvedVersionId_key" ON "Artwork"("approvedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtPassport_artworkId_key" ON "ArtPassport"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtPassport_pieceId_key" ON "ArtPassport"("pieceId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtPassport_publicSlug_key" ON "ArtPassport"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Order_commissionId_key" ON "Order"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_commissionId_key" ON "Review"("commissionId");
