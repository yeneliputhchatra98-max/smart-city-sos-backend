/*
  Warnings:

  - You are about to drop the column `createdAt` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `role_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roleId,action]` on the table `role_permissions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `role_permissions_role_action_key` ON `role_permissions`;

-- AlterTable
ALTER TABLE `role_permissions` DROP COLUMN `createdAt`,
    DROP COLUMN `description`,
    DROP COLUMN `role`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `roleId` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `role`,
    ADD COLUMN `roleId` INTEGER NULL;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `role_permissions_roleId_action_key` ON `role_permissions`(`roleId`, `action`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
