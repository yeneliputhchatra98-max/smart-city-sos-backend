/*
  Warnings:

  - You are about to drop the column `district` on the `stations` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `stations` table. All the data in the column will be lost.
  - Added the required column `districtId` to the `stations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceId` to the `stations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stations` DROP COLUMN `district`,
    DROP COLUMN `province`,
    ADD COLUMN `districtId` VARCHAR(191) NOT NULL,
    ADD COLUMN `provinceId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `provinces` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provinces_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `districts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `districts_provinceId_idx`(`provinceId`),
    UNIQUE INDEX `districts_name_provinceId_key`(`name`, `provinceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `stations_provinceId_idx` ON `stations`(`provinceId`);

-- CreateIndex
CREATE INDEX `stations_districtId_idx` ON `stations`(`districtId`);

-- AddForeignKey
ALTER TABLE `stations` ADD CONSTRAINT `stations_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stations` ADD CONSTRAINT `stations_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `districts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `districts` ADD CONSTRAINT `districts_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `provinces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
