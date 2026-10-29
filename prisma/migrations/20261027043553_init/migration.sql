/*
  Warnings:

  - The values [ACCIDENT,CRIME,FLOOD,DISASTER] on the enum `stations_type` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACCIDENT,CRIME,FLOOD,DISASTER] on the enum `stations_type` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACCIDENT,CRIME,FLOOD,DISASTER] on the enum `stations_type` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `agents` ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `userId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;

-- AlterTable
ALTER TABLE `broadcasts` MODIFY `targetAudience` ENUM('ALL_CITIZENS', 'RESCUE_AGENTS', 'POLICE', 'FIRE', 'MEDICAL') NOT NULL DEFAULT 'ALL_CITIZENS';

-- AlterTable
ALTER TABLE `citizen_reports` MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `organizations` MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;

-- AlterTable
ALTER TABLE `sos_alerts` ADD COLUMN `arrivedAt` DATETIME(3) NULL,
    ADD COLUMN `assignedAt` DATETIME(3) NULL,
    MODIFY `reportText` TEXT NOT NULL,
    MODIFY `status` ENUM('PENDING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED', 'SPAM') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `stations` MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `agents_userId_key` ON `agents`(`userId`);

-- AddForeignKey
ALTER TABLE `agents` ADD CONSTRAINT `agents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
