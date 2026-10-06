-- AlterTable
ALTER TABLE `users` ADD COLUMN `birthday` DATETIME(3) NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL;
