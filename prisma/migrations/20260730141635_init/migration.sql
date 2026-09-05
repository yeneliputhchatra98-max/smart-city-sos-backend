-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL DEFAULT 'N/A',
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'OPERATOR', 'ORG_MANAGER', 'RESCUE_AGENT', 'CITIZEN') NOT NULL DEFAULT 'CITIZEN',
    `status` ENUM('ACTIVE', 'BLOCKED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'ACTIVE',
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastPasswordChange` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `organizationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('FIRE', 'POLICE', 'MEDICAL') NOT NULL,
    `hotline` VARCHAR(191) NOT NULL,
    `head` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `accessLevel` ENUM('HIGH', 'MEDIUM', 'STANDARD') NOT NULL DEFAULT 'STANDARD',
    `gpsLat` DOUBLE NULL,
    `gpsLng` DOUBLE NULL,
    `activeVehiclesCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agents` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `type` ENUM('FIRE', 'POLICE', 'MEDICAL') NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` ENUM('AVAILABLE', 'ON_DUTY', 'OFFLINE') NOT NULL DEFAULT 'AVAILABLE',
    `vehicleNo` VARCHAR(191) NULL,
    `vehicleType` VARCHAR(191) NULL,
    `organizationId` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `officers` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NULL,
    `nameKh` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `workPhone` VARCHAR(191) NOT NULL,
    `personalPhone` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(191) NULL,
    `languages` JSON NULL,
    `status` ENUM('ON_DUTY', 'OFF_DUTY', 'RESPONDING') NOT NULL DEFAULT 'ON_DUTY',
    `shift` ENUM('DAY', 'NIGHT') NOT NULL DEFAULT 'DAY',
    `assignedSos` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('FIRE', 'POLICE', 'MEDICAL') NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `hotline` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `organizationId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sos_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `citizenName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `type` ENUM('FIRE', 'POLICE', 'MEDICAL') NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL DEFAULT 'Phnom Penh',
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `reportText` VARCHAR(191) NOT NULL,
    `hasMedia` BOOLEAN NOT NULL DEFAULT false,
    `mediaUrls` JSON NULL,
    `status` ENUM('PENDING', 'EN_ROUTE', 'RESOLVED', 'SPAM') NOT NULL DEFAULT 'PENDING',
    `assignedAgentId` VARCHAR(191) NULL,
    `assignedAgentName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcasts` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `level` ENUM('CRITICAL', 'WARNING', 'INFO') NOT NULL DEFAULT 'WARNING',
    `type` ENUM('FLOOD', 'STORM', 'FIRE', 'TRAFFIC', 'SECURITY', 'MEDICAL_CRISIS', 'GENERAL_ANNOUNCEMENT') NOT NULL DEFAULT 'SECURITY',
    `targetAudience` ENUM('ALL_CITIZENS', 'RESCUE_AGENTS') NOT NULL DEFAULT 'ALL_CITIZENS',
    `status` ENUM('ACTIVE', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `targetProvinces` JSON NULL,
    `reachCount` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NULL,
    `sentByUserId` VARCHAR(191) NULL,
    `sentByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `content` VARCHAR(191) NOT NULL,
    `coverUrl` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'General',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `authorId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `news_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isEncrypted` BOOLEAN NOT NULL DEFAULT false,
    `updatedByUserId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'OPERATOR', 'ORG_MANAGER', 'RESCUE_AGENT', 'CITIZEN') NOT NULL,
    `action` ENUM('VIEW_MAP', 'DISPATCH', 'BROADCAST', 'MANAGE_USERS', 'MANAGE_ORGS', 'PUBLISH_NEWS', 'EXPORT_REPORTS', 'SYSTEM_SETTINGS') NOT NULL,
    `isGranted` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_permissions_role_action_key`(`role`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_exports` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `reportType` ENUM('SUMMARY', 'DETAIL', 'EXCEPTION') NOT NULL DEFAULT 'SUMMARY',
    `format` ENUM('PDF', 'EXCEL') NOT NULL DEFAULT 'PDF',
    `fileUrl` VARCHAR(191) NULL,
    `fileSize` VARCHAR(191) NULL,
    `recordCount` INTEGER NOT NULL DEFAULT 0,
    `resolvedCount` INTEGER NOT NULL DEFAULT 0,
    `delayedCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agents` ADD CONSTRAINT `agents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `officers` ADD CONSTRAINT `officers_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stations` ADD CONSTRAINT `stations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_assignedAgentId_fkey` FOREIGN KEY (`assignedAgentId`) REFERENCES `agents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news` ADD CONSTRAINT `news_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_exports` ADD CONSTRAINT `report_exports_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
