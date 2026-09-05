const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all officers
exports.getAllOfficers = async (req, res, next) => {
  try {
    const officers = await prisma.officer.findMany({
      include: { agency: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: officers });
  } catch (err) {
    next(err);
  }
};

// Get officer by ID
exports.getOfficerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const officer = await prisma.officer.findUnique({
      where: { id },
      include: { agency: true }
    });
    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found' });
    }
    return res.status(200).json({ success: true, data: officer });
  } catch (err) {
    next(err);
  }
};

// Create officer
exports.createOfficer = async (req, res, next) => {
  try {
    const { agencyId, nameKh, nameEn, title, workPhone, personalPhone, photoUrl, languages, status, shift } = req.body;
    const officer = await prisma.officer.create({
      data: {
        agencyId: agencyId || null,
        nameKh,
        nameEn,
        title,
        workPhone,
        personalPhone: personalPhone || null,
        photoUrl: photoUrl || null,
        languages: languages || ["KH", "EN"],
        status: status || 'ON_DUTY',
        shift: shift || 'DAY'
      }
    });
    return res.status(201).json({ success: true, data: officer });
  } catch (err) {
    next(err);
  }
};

// Update officer
exports.updateOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { agencyId, nameKh, nameEn, title, workPhone, personalPhone, photoUrl, languages, status, shift } = req.body;
    const officer = await prisma.officer.update({
      where: { id },
      data: {
        agencyId: agencyId !== undefined ? agencyId : undefined,
        nameKh,
        nameEn,
        title,
        workPhone,
        personalPhone,
        photoUrl,
        languages,
        status,
        shift
      }
    });
    return res.status(200).json({ success: true, data: officer });
  } catch (err) {
    next(err);
  }
};

// Delete officer
exports.deleteOfficer = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.officer.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Officer deleted successfully' });
  } catch (err) {
    next(err);
  }
};
