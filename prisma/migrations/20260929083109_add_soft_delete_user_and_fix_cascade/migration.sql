-- DropForeignKey
ALTER TABLE `role_permissions` DROP FOREIGN KEY `role_permissions_roleId_fkey`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('ACTIVE', 'BLOCKED', 'PENDING_VERIFICATION', 'INACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX `users_deletedAt_idx` ON `users`(`deletedAt`);

-- CreateIndex
CREATE INDEX `users_status_idx` ON `users`(`status`);

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `stations` DROP FOREIGN KEY `stations_organizationId_fkey`;
ALTER TABLE `stations` DROP INDEX `stations_organizationId_fkey`;
CREATE INDEX `stations_organizationId_idx` ON `stations`(`organizationId`);
ALTER TABLE `stations` ADD CONSTRAINT `stations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `users` DROP FOREIGN KEY `users_organizationId_fkey`;
ALTER TABLE `users` DROP INDEX `users_organizationId_fkey`;
CREATE INDEX `users_organizationId_idx` ON `users`(`organizationId`);
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `users` DROP FOREIGN KEY `users_roleId_fkey`;
ALTER TABLE `users` DROP INDEX `users_roleId_fkey`;
CREATE INDEX `users_roleId_idx` ON `users`(`roleId`);
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
