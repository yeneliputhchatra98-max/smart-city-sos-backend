-- CreateTable
CREATE TABLE `citizen_reports` (
    `id` VARCHAR(191) NOT NULL,
    `citizenName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `type` ENUM('FIRE', 'MEDICAL', 'POLICE', 'ACCIDENT', 'CRIME', 'FLOOD', 'DISASTER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `mediaUrls` JSON NULL,
    `status` ENUM('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
