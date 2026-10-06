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
ALTER TABLE `stations` RENAME INDEX `stations_organizationId_fkey` TO `stations_organizationId_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `users_organizationId_fkey` TO `users_organizationId_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `users_roleId_fkey` TO `users_roleId_idx`;
