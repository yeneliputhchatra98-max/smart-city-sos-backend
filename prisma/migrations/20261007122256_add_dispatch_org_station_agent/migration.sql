-- AlterTable
ALTER TABLE `agents` ADD COLUMN `lastUpdated` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('AVAILABLE', 'ON_DUTY', 'OFFLINE', 'EN_ROUTE', 'ON_SCENE', 'RESOLVING') NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE `sos_alerts` ADD COLUMN `assignedOrganizationId` VARCHAR(191) NULL,
    ADD COLUMN `assignedOrganizationName` VARCHAR(191) NULL,
    ADD COLUMN `assignedStationId` VARCHAR(191) NULL,
    ADD COLUMN `assignedStationName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `stations` ADD COLUMN `activeVehiclesCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `plateNumber` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `type` ENUM('FIRE_TRUCK', 'AMBULANCE', 'POLICE_CAR', 'MOTORBIKE', 'RESCUE_BOAT', 'COMMAND_UNIT', 'OTHER') NOT NULL DEFAULT 'POLICE_CAR',
    `status` ENUM('AVAILABLE', 'ON_DUTY', 'DISPATCHED', 'MAINTENANCE', 'OUT_OF_SERVICE') NOT NULL DEFAULT 'AVAILABLE',
    `fuelLevel` INTEGER NULL DEFAULT 100,
    `mileage` DOUBLE NULL DEFAULT 0,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `organizationId` VARCHAR(191) NULL,
    `stationId` VARCHAR(191) NULL,
    `assignedAgentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicles_plateNumber_key`(`plateNumber`),
    UNIQUE INDEX `vehicles_assignedAgentId_key`(`assignedAgentId`),
    INDEX `vehicles_organizationId_idx`(`organizationId`),
    INDEX `vehicles_stationId_idx`(`stationId`),
    INDEX `vehicles_status_idx`(`status`),
    INDEX `vehicles_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tabId` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_refreshToken_key`(`refreshToken`),
    INDEX `sessions_userId_idx`(`userId`),
    INDEX `sessions_tabId_idx`(`tabId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `agents_type_idx` ON `agents`(`type`);

-- CreateIndex
CREATE INDEX `organizations_type_idx` ON `organizations`(`type`);

-- CreateIndex
CREATE INDEX `organizations_status_idx` ON `organizations`(`status`);

-- CreateIndex
CREATE INDEX `sos_alerts_assignedOrganizationId_idx` ON `sos_alerts`(`assignedOrganizationId`);

-- CreateIndex
CREATE INDEX `sos_alerts_assignedStationId_idx` ON `sos_alerts`(`assignedStationId`);

-- CreateIndex
CREATE INDEX `sos_alerts_status_idx` ON `sos_alerts`(`status`);

-- CreateIndex
CREATE INDEX `sos_alerts_type_idx` ON `sos_alerts`(`type`);

-- CreateIndex
CREATE INDEX `sos_alerts_createdAt_idx` ON `sos_alerts`(`createdAt`);

-- CreateIndex
CREATE INDEX `stations_status_idx` ON `stations`(`status`);

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_assignedAgentId_fkey` FOREIGN KEY (`assignedAgentId`) REFERENCES `agents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_assignedOrganizationId_fkey` FOREIGN KEY (`assignedOrganizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_assignedStationId_fkey` FOREIGN KEY (`assignedStationId`) REFERENCES `stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `sos_alerts` RENAME INDEX `sos_alerts_assignedAgentId_fkey` TO `sos_alerts_assignedAgentId_idx`;
