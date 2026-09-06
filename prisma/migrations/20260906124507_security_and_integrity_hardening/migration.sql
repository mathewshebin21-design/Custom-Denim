-- CreateIndex
CREATE INDEX "ArtistAssignment_artistId_idx" ON "ArtistAssignment"("artistId");

-- CreateIndex
CREATE INDEX "Commission_customerId_idx" ON "Commission"("customerId");

-- CreateIndex
CREATE INDEX "Commission_garmentId_idx" ON "Commission"("garmentId");

-- CreateIndex
CREATE INDEX "Concept_commissionId_idx" ON "Concept"("commissionId");

-- CreateIndex
CREATE INDEX "ConceptVersion_creativeDirectionId_idx" ON "ConceptVersion"("creativeDirectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptVersion_conceptId_versionNumber_key" ON "ConceptVersion"("conceptId", "versionNumber");

-- CreateIndex
CREATE INDEX "CreativeDirection_conceptId_idx" ON "CreativeDirection"("conceptId");

-- CreateIndex
CREATE INDEX "ProductionStage_commissionId_idx" ON "ProductionStage"("commissionId");

-- CreateIndex
CREATE INDEX "ProductionUpdate_commissionId_idx" ON "ProductionUpdate"("commissionId");

-- CreateIndex
CREATE INDEX "ReferenceImage_commissionId_idx" ON "ReferenceImage"("commissionId");

-- CreateIndex
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");
