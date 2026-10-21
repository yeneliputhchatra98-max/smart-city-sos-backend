const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '../../storage/backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get all available database backups
 */
const getBackups = async () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    const backups = [];

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        let recordCount = 0;
        let status = 'Success';

        try {
          // Read light header
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          recordCount = parsed.totalRecords || 0;
        } catch (_) {
          status = 'Failed';
        }

        const id = file.replace(/\.json$/, '');
        backups.push({
          id,
          filename: file,
          timestamp: formatTimestamp(stats.mtime),
          isoTimestamp: stats.mtime.toISOString(),
          size: formatBytes(stats.size),
          sizeBytes: stats.size,
          recordCount,
          status,
        });
      } catch (_) {}
    }

    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => new Date(b.isoTimestamp) - new Date(a.isoTimestamp));

    return backups;
  } catch (error) {
    console.error('[BackupService] getBackups error:', error);
    throw error;
  }
};

/**
 * Create a new full database snapshot backup
 */
const createBackup = async (user = null) => {
  try {
    const timestamp = new Date();
    const fileId = `backup_${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const filename = `${fileId}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Fetch data from key application models
    const [
      systemSettings,
      roles,
      rolePermissions,
      provinces,
      districts,
      communes,
      organizations,
      stations,
      users,
      agents,
      officers,
      vehicles,
      sosAlerts,
      citizenReports,
      broadcasts,
      news,
      auditLogs,
    ] = await Promise.all([
      prisma.systemSetting.findMany(),
      prisma.role.findMany(),
      prisma.rolePermission.findMany(),
      prisma.province.findMany(),
      prisma.district.findMany(),
      prisma.commune.findMany(),
      prisma.organization.findMany(),
      prisma.station.findMany(),
      prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
          badgeId: true,
          username: true,
          email: true,
          password: true,
          phone: true,
          avatar: true,
          birthday: true,
          gender: true,
          roleId: true,
          status: true,
          mfaEnabled: true,
          organizationId: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.agent.findMany(),
      prisma.officer.findMany(),
      prisma.vehicle.findMany(),
      (prisma.sOSAlert || prisma.sosAlert).findMany(),
      prisma.citizenReport.findMany(),
      prisma.broadcast.findMany(),
      prisma.news.findMany(),
      prisma.auditLog.findMany({ take: 200, orderBy: { createdAt: 'desc' } }),
    ]);

    const tables = {
      systemSettings,
      roles,
      rolePermissions,
      provinces,
      districts,
      communes,
      organizations,
      stations,
      users,
      agents,
      officers,
      vehicles,
      sosAlerts,
      citizenReports,
      broadcasts,
      news,
      auditLogs,
    };

    let totalRecords = 0;
    for (const rows of Object.values(tables)) {
      totalRecords += rows.length;
    }

    const payload = {
      version: '1.0.0',
      system: 'Smart City SOS Cambodia',
      createdAt: timestamp.toISOString(),
      createdBy: user ? user.fullName || user.email : 'System Admin',
      totalRecords,
      tables,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    const stats = fs.statSync(filePath);

    // Record audit log if possible
    try {
      const auditService = require('./audit.service');
      await auditService.createAuditLog(
        {
          event: `Database Backup Created: ${filename} (${totalRecords} records, ${formatBytes(stats.size)})`,
          userName: user?.fullName || 'System Admin',
          userId: user?.id || null,
        },
        user?.id || null
      );
    } catch (_) {}

    return {
      id: fileId,
      filename,
      timestamp: formatTimestamp(timestamp),
      isoTimestamp: timestamp.toISOString(),
      size: formatBytes(stats.size),
      sizeBytes: stats.size,
      recordCount: totalRecords,
      status: 'Success',
    };
  } catch (error) {
    console.error('[BackupService] createBackup error:', error);
    throw error;
  }
};

/**
 * Restore database from a specific snapshot file
 */
const restoreBackup = async (backupId, user = null) => {
  try {
    const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const snapshot = JSON.parse(content);

    if (!snapshot.tables) {
      throw new Error('Invalid backup file format: missing tables');
    }

    let restoredCount = 0;

    // Restore system settings safely
    if (Array.isArray(snapshot.tables.systemSettings)) {
      for (const item of snapshot.tables.systemSettings) {
        await prisma.systemSetting.upsert({
          where: { key: item.key },
          update: {
            value: item.value,
            description: item.description,
          },
          create: {
            key: item.key,
            value: item.value,
            description: item.description,
          },
        });
        restoredCount++;
      }
    }

    // Restore broadcast messages
    if (Array.isArray(snapshot.tables.broadcasts)) {
      for (const b of snapshot.tables.broadcasts) {
        await prisma.broadcast.upsert({
          where: { id: b.id },
          update: {
            title: b.title,
            message: b.message,
            level: b.level,
            type: b.type,
            status: b.status,
          },
          create: {
            id: b.id,
            title: b.title,
            message: b.message,
            level: b.level,
            type: b.type,
            status: b.status,
            targetAudience: b.targetAudience,
            reachCount: b.reachCount || 0,
            sentByName: b.sentByName,
          },
        });
        restoredCount++;
      }
    }

    // Restore news articles
    if (Array.isArray(snapshot.tables.news)) {
      for (const n of snapshot.tables.news) {
        await prisma.news.upsert({
          where: { slug: n.slug },
          update: {
            title: n.title,
            summary: n.summary,
            content: n.content,
            coverUrl: n.coverUrl,
            category: n.category,
            status: n.status,
          },
          create: {
            id: n.id,
            title: n.title,
            slug: n.slug,
            summary: n.summary,
            content: n.content,
            coverUrl: n.coverUrl,
            category: n.category,
            status: n.status,
          },
        });
        restoredCount++;
      }
    }

    // Log the restore event
    try {
      const auditService = require('./audit.service');
      await auditService.createAuditLog(
        {
          event: `Database Snapshot Restored from: ${filename} (${restoredCount} core records synced)`,
          userName: user?.fullName || 'System Admin',
          userId: user?.id || null,
        },
        user?.id || null
      );
    } catch (_) {}

    return {
      success: true,
      filename,
      restoredRecords: restoredCount,
      restoredAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[BackupService] restoreBackup error:', error);
    throw error;
  }
};

/**
 * Get file path for downloading backup
 */
const getBackupFilePath = (backupId) => {
  const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file does not exist');
  }

  return { filePath, filename };
};

/**
 * Delete a backup file
 */
const deleteBackup = async (backupId) => {
  const filename = backupId.endsWith('.json') ? backupId : `${backupId}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file not found');
  }

  fs.unlinkSync(filePath);
  return { success: true, deletedId: backupId };
};

module.exports = {
  getBackups,
  createBackup,
  restoreBackup,
  getBackupFilePath,
  deleteBackup,
};
