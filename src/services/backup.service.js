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
        let createdBy = 'System Admin';
        let breakdown = { alerts: 0, vehicles: 0, users: 0, stations: 0 };

        try {
          // Read light header
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          recordCount = parsed.totalRecords || 0;
          createdBy = parsed.createdBy || (file.includes('auto') ? 'Automated Daily Scheduler' : 'System Admin');
          if (parsed.tables) {
            breakdown = {
              alerts: parsed.tables.sosAlerts?.length || 0,
              vehicles: parsed.tables.vehicles?.length || 0,
              users: parsed.tables.users?.length || 0,
              stations: parsed.tables.stations?.length || 0,
            };
          }
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
          createdBy,
          breakdown,
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
    const t = snapshot.tables;

    // 1. Restore Roles
    if (Array.isArray(t.roles)) {
      for (const r of t.roles) {
        try {
          await prisma.role.upsert({
            where: { id: r.id },
            update: { name: r.name, description: r.description },
            create: { id: r.id, name: r.name, description: r.description },
          });
          restoredCount++;
        } catch (_) {}
      }
    }

    // 2. Restore Role Permissions
    if (Array.isArray(t.rolePermissions)) {
      for (const rp of t.rolePermissions) {
        try {
          await prisma.rolePermission.upsert({
            where: { id: rp.id },
            update: { roleId: rp.roleId, action: rp.action, isGranted: rp.isGranted },
            create: { id: rp.id, roleId: rp.roleId, action: rp.action, isGranted: rp.isGranted },
          });
          restoredCount++;
        } catch (_) {}
      }
    }

    // 3. Restore Administrative Geography (Provinces -> Districts -> Communes)
    const provinceIdMap = new Map();
    if (Array.isArray(t.provinces)) {
      for (const p of t.provinces) {
        try {
          const existing = await prisma.province.findFirst({
            where: { OR: [{ id: p.id }, { name: p.name }] },
          });
          if (existing) {
            provinceIdMap.set(p.id, existing.id);
            await prisma.province.update({
              where: { id: existing.id },
              data: { name: p.name, nameKm: p.nameKm || null },
            });
          } else {
            const created = await prisma.province.create({
              data: { id: p.id, name: p.name, nameKm: p.nameKm || null },
            });
            provinceIdMap.set(p.id, created.id);
          }
          restoredCount++;
        } catch (_) {}
      }
    }

    const districtIdMap = new Map();
    if (Array.isArray(t.districts)) {
      for (const d of t.districts) {
        try {
          const mappedProvId = provinceIdMap.get(d.provinceId) || d.provinceId;
          const existing = await prisma.district.findFirst({
            where: {
              OR: [
                { id: d.id },
                { name: d.name, provinceId: mappedProvId },
              ],
            },
          });
          if (existing) {
            districtIdMap.set(d.id, existing.id);
            await prisma.district.update({
              where: { id: existing.id },
              data: { name: d.name, nameKm: d.nameKm || null, provinceId: mappedProvId },
            });
          } else {
            const created = await prisma.district.create({
              data: { id: d.id, name: d.name, nameKm: d.nameKm || null, provinceId: mappedProvId },
            });
            districtIdMap.set(d.id, created.id);
          }
          restoredCount++;
        } catch (_) {}
      }
    }

    const communeIdMap = new Map();
    if (Array.isArray(t.communes)) {
      for (const c of t.communes) {
        try {
          const mappedDistId = districtIdMap.get(c.districtId) || c.districtId;
          const existing = await prisma.commune.findFirst({
            where: {
              OR: [
                { id: c.id },
                { name: c.name, districtId: mappedDistId },
              ],
            },
          });
          if (existing) {
            communeIdMap.set(c.id, existing.id);
            await prisma.commune.update({
              where: { id: existing.id },
              data: { name: c.name, nameKm: c.nameKm || null, districtId: mappedDistId },
            });
          } else {
            const created = await prisma.commune.create({
              data: { id: c.id, name: c.name, nameKm: c.nameKm || null, districtId: mappedDistId },
            });
            communeIdMap.set(c.id, created.id);
          }
          restoredCount++;
        } catch (_) {}
      }
    }

    // 4. Restore Organizations
    if (Array.isArray(t.organizations)) {
      for (const org of t.organizations) {
        try {
          await prisma.organization.upsert({
            where: { id: org.id },
            update: {
              name: org.name,
              type: org.type,
              hotline: org.hotline,
              head: org.head,
              address: org.address,
              status: org.status || 'ACTIVE',
              accessLevel: org.accessLevel || 'STANDARD',
              gpsLat: org.gpsLat ?? null,
              gpsLng: org.gpsLng ?? null,
              activeVehiclesCount: org.activeVehiclesCount || 0,
            },
            create: {
              id: org.id,
              name: org.name,
              type: org.type,
              hotline: org.hotline,
              head: org.head,
              address: org.address,
              status: org.status || 'ACTIVE',
              accessLevel: org.accessLevel || 'STANDARD',
              gpsLat: org.gpsLat ?? null,
              gpsLng: org.gpsLng ?? null,
              activeVehiclesCount: org.activeVehiclesCount || 0,
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore Org Skip] ${org.name}:`, err.message);
        }
      }
    }

    // 5. Restore Stations
    if (Array.isArray(t.stations)) {
      for (const st of t.stations) {
        try {
          const mappedProvId = provinceIdMap.get(st.provinceId) || st.provinceId;
          const mappedDistId = districtIdMap.get(st.districtId) || st.districtId;
          const mappedCommId = communeIdMap.get(st.communeId) || st.communeId;

          await prisma.station.upsert({
            where: { id: st.id },
            update: {
              name: st.name,
              type: st.type,
              provinceId: mappedProvId,
              districtId: mappedDistId,
              communeId: mappedCommId,
              address: st.address,
              hotline: st.hotline,
              lat: st.lat ?? null,
              lng: st.lng ?? null,
              capacity: st.capacity || 0,
              activeVehiclesCount: st.activeVehiclesCount || 0,
              organizationId: st.organizationId || null,
              status: st.status || 'ACTIVE',
            },
            create: {
              id: st.id,
              name: st.name,
              type: st.type,
              provinceId: mappedProvId,
              districtId: mappedDistId,
              communeId: mappedCommId,
              address: st.address,
              hotline: st.hotline,
              lat: st.lat ?? null,
              lng: st.lng ?? null,
              capacity: st.capacity || 0,
              activeVehiclesCount: st.activeVehiclesCount || 0,
              organizationId: st.organizationId || null,
              status: st.status || 'ACTIVE',
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore Station Skip] ${st.name}:`, err.message);
        }
      }
    }

    // 6. Restore Users
    if (Array.isArray(t.users)) {
      for (const u of t.users) {
        try {
          const userData = {
            fullName: u.fullName,
            badgeId: u.badgeId || 'N/A',
            username: u.username || null,
            email: u.email,
            phone: u.phone || null,
            avatar: u.avatar || 'uploads/avatars/account-avatar-profile-user.svg',
            birthday: u.birthday ? new Date(u.birthday) : null,
            gender: u.gender || null,
            roleId: u.roleId || null,
            status: u.status || 'ACTIVE',
            mfaEnabled: Boolean(u.mfaEnabled),
            organizationId: u.organizationId || null,
            emailVerified: Boolean(u.emailVerified),
          };
          if (u.password) {
            userData.password = u.password;
          }

          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: u.id },
                { email: u.email },
                ...(u.username ? [{ username: u.username }] : []),
              ],
            },
          });

          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: userData,
            });
          } else {
            await prisma.user.create({
              data: {
                id: u.id,
                ...userData,
              },
            });
          }
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore User Skip] ${u.email}:`, err.message);
        }
      }
    }

    // 7. Restore Agents
    if (Array.isArray(t.agents)) {
      for (const ag of t.agents) {
        try {
          await prisma.agent.upsert({
            where: { id: ag.id },
            update: {
              name: ag.name,
              email: ag.email || null,
              role: ag.role,
              type: ag.type,
              phone: ag.phone,
              status: ag.status || 'AVAILABLE',
              vehicleNo: ag.vehicleNo || null,
              vehicleType: ag.vehicleType || null,
              userId: ag.userId || null,
              stationId: ag.stationId || null,
              organizationId: ag.organizationId || null,
              lat: ag.lat ?? null,
              lng: ag.lng ?? null,
            },
            create: {
              id: ag.id,
              name: ag.name,
              email: ag.email || null,
              role: ag.role,
              type: ag.type,
              phone: ag.phone,
              status: ag.status || 'AVAILABLE',
              vehicleNo: ag.vehicleNo || null,
              vehicleType: ag.vehicleType || null,
              userId: ag.userId || null,
              stationId: ag.stationId || null,
              organizationId: ag.organizationId || null,
              lat: ag.lat ?? null,
              lng: ag.lng ?? null,
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore Agent Skip] ${ag.name}:`, err.message);
        }
      }
    }

    // 8. Restore Officers
    if (Array.isArray(t.officers)) {
      for (const off of t.officers) {
        try {
          await prisma.officer.upsert({
            where: { id: off.id },
            update: {
              agencyId: off.agencyId || null,
              nameKh: off.nameKh,
              nameEn: off.nameEn,
              title: off.title,
              workPhone: off.workPhone,
              personalPhone: off.personalPhone || null,
              photoUrl: off.photoUrl || null,
              languages: off.languages || null,
              status: off.status || 'ON_DUTY',
              shift: off.shift || 'DAY',
              assignedSos: off.assignedSos || null,
            },
            create: {
              id: off.id,
              agencyId: off.agencyId || null,
              nameKh: off.nameKh,
              nameEn: off.nameEn,
              title: off.title,
              workPhone: off.workPhone,
              personalPhone: off.personalPhone || null,
              photoUrl: off.photoUrl || null,
              languages: off.languages || null,
              status: off.status || 'ON_DUTY',
              shift: off.shift || 'DAY',
              assignedSos: off.assignedSos || null,
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore Officer Skip] ${off.nameKh}:`, err.message);
        }
      }
    }

    // 9. Restore Vehicles
    if (Array.isArray(t.vehicles)) {
      for (const v of t.vehicles) {
        try {
          await prisma.vehicle.upsert({
            where: { id: v.id },
            update: {
              plateNumber: v.plateNumber,
              model: v.model || null,
              type: v.type || 'POLICE_CAR',
              status: v.status || 'AVAILABLE',
              fuelLevel: v.fuelLevel ?? 100,
              mileage: v.mileage ?? 0,
              lat: v.lat ?? null,
              lng: v.lng ?? null,
              organizationId: v.organizationId || null,
              stationId: v.stationId || null,
              assignedAgentId: v.assignedAgentId || null,
            },
            create: {
              id: v.id,
              plateNumber: v.plateNumber,
              model: v.model || null,
              type: v.type || 'POLICE_CAR',
              status: v.status || 'AVAILABLE',
              fuelLevel: v.fuelLevel ?? 100,
              mileage: v.mileage ?? 0,
              lat: v.lat ?? null,
              lng: v.lng ?? null,
              organizationId: v.organizationId || null,
              stationId: v.stationId || null,
              assignedAgentId: v.assignedAgentId || null,
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore Vehicle Skip] ${v.plateNumber}:`, err.message);
        }
      }
    }

    // 10. Restore SOS Alerts
    if (Array.isArray(t.sosAlerts)) {
      const sosModel = prisma.sOSAlert || prisma.sosAlert;
      for (const s of t.sosAlerts) {
        try {
          await sosModel.upsert({
            where: { id: s.id },
            update: {
              citizenName: s.citizenName,
              phone: s.phone,
              type: s.type,
              district: s.district,
              province: s.province || 'Phnom Penh',
              lat: s.lat,
              lng: s.lng,
              reportText: s.reportText || '',
              hasMedia: Boolean(s.hasMedia),
              mediaUrls: s.mediaUrls || null,
              status: s.status || 'PENDING',
              priority: s.priority || 'HIGH',
              assignedOrganizationId: s.assignedOrganizationId || null,
              assignedOrganizationName: s.assignedOrganizationName || null,
              assignedStationId: s.assignedStationId || null,
              assignedStationName: s.assignedStationName || null,
              assignedAgentId: s.assignedAgentId || null,
              assignedAgentName: s.assignedAgentName || null,
              assignedAt: s.assignedAt ? new Date(s.assignedAt) : null,
              arrivedAt: s.arrivedAt ? new Date(s.arrivedAt) : null,
              resolvedAt: s.resolvedAt ? new Date(s.resolvedAt) : null,
            },
            create: {
              id: s.id,
              citizenName: s.citizenName,
              phone: s.phone,
              type: s.type,
              district: s.district,
              province: s.province || 'Phnom Penh',
              lat: s.lat,
              lng: s.lng,
              reportText: s.reportText || '',
              hasMedia: Boolean(s.hasMedia),
              mediaUrls: s.mediaUrls || null,
              status: s.status || 'PENDING',
              priority: s.priority || 'HIGH',
              assignedOrganizationId: s.assignedOrganizationId || null,
              assignedOrganizationName: s.assignedOrganizationName || null,
              assignedStationId: s.assignedStationId || null,
              assignedStationName: s.assignedStationName || null,
              assignedAgentId: s.assignedAgentId || null,
              assignedAgentName: s.assignedAgentName || null,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
              assignedAt: s.assignedAt ? new Date(s.assignedAt) : null,
              arrivedAt: s.arrivedAt ? new Date(s.arrivedAt) : null,
              resolvedAt: s.resolvedAt ? new Date(s.resolvedAt) : null,
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore SOSAlert Skip] ${s.id}:`, err.message);
        }
      }
    }

    // 11. Restore Citizen Reports
    if (Array.isArray(t.citizenReports)) {
      for (const cr of t.citizenReports) {
        try {
          await prisma.citizenReport.upsert({
            where: { id: cr.id },
            update: {
              citizenName: cr.citizenName,
              phone: cr.phone || null,
              type: cr.type,
              title: cr.title,
              description: cr.description,
              province: cr.province,
              district: cr.district,
              lat: cr.lat ?? null,
              lng: cr.lng ?? null,
              mediaUrls: cr.mediaUrls || null,
              status: cr.status || 'PENDING',
            },
            create: {
              id: cr.id,
              citizenName: cr.citizenName,
              phone: cr.phone || null,
              type: cr.type,
              title: cr.title,
              description: cr.description,
              province: cr.province,
              district: cr.district,
              lat: cr.lat ?? null,
              lng: cr.lng ?? null,
              mediaUrls: cr.mediaUrls || null,
              status: cr.status || 'PENDING',
            },
          });
          restoredCount++;
        } catch (err) {
          console.warn(`[Restore CitizenReport Skip] ${cr.id}:`, err.message);
        }
      }
    }

    // 12. Restore System Settings
    if (Array.isArray(t.systemSettings)) {
      for (const item of t.systemSettings) {
        try {
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
        } catch (_) {}
      }
    }

    // 13. Restore Broadcast Messages
    if (Array.isArray(t.broadcasts)) {
      for (const b of t.broadcasts) {
        try {
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
        } catch (_) {}
      }
    }

    // 14. Restore News Articles
    if (Array.isArray(t.news)) {
      for (const n of t.news) {
        try {
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
        } catch (_) {}
      }
    }

    // Log the restore event
    try {
      const auditService = require('./audit.service');
      await auditService.createAuditLog(
        {
          event: `Database Snapshot Restored from: ${filename} (${restoredCount} total records synchronized)`,
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

/**
 * Retention Cleanup: Remove backups older than retentionDays
 */
const purgeExpiredBackups = async (retentionDays = 30) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return 0;
    const days = parseInt(retentionDays, 10) || 30;
    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (_) {}
    }
    if (deletedCount > 0) {
      console.log(`[Backup Retention] Purged ${deletedCount} backup files older than ${days} days.`);
    }
    return deletedCount;
  } catch (error) {
    console.error('[BackupService] purgeExpiredBackups error:', error);
    return 0;
  }
};

/**
 * Background Scheduler for Daily Backups & Retention Purge
 */
let backupSchedulerTimer = null;
let lastBackupRunDate = null;

const startBackupScheduler = () => {
  if (backupSchedulerTimer) return;

  const checkSchedule = async () => {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: ['automatedBackups', 'backupTime', 'dataRetentionDays'],
          },
        },
      });

      const config = {};
      for (const s of settings) {
        config[s.key] = s.value;
      }

      const isAutomated = String(config.automatedBackups).toLowerCase() === 'true';
      if (!isAutomated) return;

      const targetTime = config.backupTime || '02:00 AM';
      const retentionDays = parseInt(config.dataRetentionDays, 10) || 30;

      // Current time in "hh:mm A" format
      const now = new Date();
      const nowFormatted = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const todayDate = now.toISOString().split('T')[0];

      // Check if current hour:minute matches target and hasn't run today
      if (nowFormatted === targetTime && lastBackupRunDate !== todayDate) {
        lastBackupRunDate = todayDate;
        console.log(`[Backup Scheduler] Triggering automated daily backup at ${nowFormatted}...`);
        await createBackup({ fullName: 'Automated Daily Scheduler' });
        await purgeExpiredBackups(retentionDays);
      }
    } catch (err) {
      console.error('[Backup Scheduler Error]:', err.message);
    }
  };

  // Run initial retention purge on startup after 10s
  setTimeout(() => {
    purgeExpiredBackups(30);
  }, 10000);

  // Check every 45 seconds to catch the exact minute
  backupSchedulerTimer = setInterval(checkSchedule, 45000);
  if (backupSchedulerTimer.unref) {
    backupSchedulerTimer.unref();
  }
};

module.exports = {
  getBackups,
  createBackup,
  restoreBackup,
  getBackupFilePath,
  deleteBackup,
  purgeExpiredBackups,
  startBackupScheduler,
};

