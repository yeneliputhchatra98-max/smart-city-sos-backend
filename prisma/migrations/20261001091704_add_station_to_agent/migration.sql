-- AlterTable
ALTER TABLE `agents` ADD COLUMN `stationId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `agents_stationId_idx` ON `agents`(`stationId`);

-- CreateIndex
CREATE INDEX `agents_status_idx` ON `agents`(`status`);

-- AddForeignKey
ALTER TABLE `agents` ADD CONSTRAINT `agents_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `agents` RENAME INDEX `agents_organizationId_fkey` TO `agents_organizationId_idx`;
