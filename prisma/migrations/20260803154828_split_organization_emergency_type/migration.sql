-- AlterTable
ALTER TABLE `agents` MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;

-- AlterTable
ALTER TABLE `organizations` MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;

-- AlterTable
ALTER TABLE `sos_alerts` MODIFY `type` ENUM('FIRE', 'MEDICAL', 'POLICE', 'ACCIDENT', 'CRIME', 'FLOOD', 'DISASTER') NOT NULL;

-- AlterTable
ALTER TABLE `stations` MODIFY `type` ENUM('POLICE', 'FIRE', 'MEDICAL') NOT NULL;
