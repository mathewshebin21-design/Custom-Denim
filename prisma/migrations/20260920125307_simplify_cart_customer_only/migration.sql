/*
  Warnings:

  - You are about to drop the column `sessionId` on the `Cart` table. All the data in the column will be lost.
  - Made the column `customerId` on table `Cart` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Cart_sessionId_key";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "sessionId",
ALTER COLUMN "customerId" SET NOT NULL;
