/*
  Warnings:

  - Added the required column `communeId` to the `stations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stations` ADD COLUMN `communeId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `communes` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `districtId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `communes_districtId_idx`(`districtId`),
    UNIQUE INDEX `communes_name_districtId_key`(`name`, `districtId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `stations_communeId_idx` ON `stations`(`communeId`);

-- AddForeignKey
ALTER TABLE `stations` ADD CONSTRAINT `stations_communeId_fkey` FOREIGN KEY (`communeId`) REFERENCES `communes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `communes` ADD CONSTRAINT `communes_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `districts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
