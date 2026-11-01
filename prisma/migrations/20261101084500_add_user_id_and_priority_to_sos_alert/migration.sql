-- AlterTable
ALTER TABLE `sos_alerts` 
    ADD COLUMN `userId` VARCHAR(191) NULL,
    ADD COLUMN `priority` VARCHAR(191) NULL DEFAULT 'HIGH';

-- CreateIndex
CREATE INDEX `sos_alerts_userId_idx` ON `sos_alerts`(`userId`);

-- AddForeignKey
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

