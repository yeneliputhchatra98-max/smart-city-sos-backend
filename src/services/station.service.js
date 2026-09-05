const prisma = require("../config/prisma");

// Get all stations
const getAllStations = async (filters = {}) => {
  const { type, province, district, status, organizationId, search } = filters;

  return await prisma.station.findMany({
    where: {
      ...(type && { type }),
      ...(province && { province }),
      ...(district && { district }),
      ...(status && { status }),
      ...(organizationId && { organizationId }),

      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            hotline: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),
    },

    include: {
      organization: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

// Get station by ID
const getStationById = async (id) => {
  const station = await prisma.station.findUnique({
    where: { id },

    include: {
      organization: true,
    },
  });

  if (!station) {
    throw new Error("Station not found");
  }

  return station;
};

// Create station
const createStation = async (data) => {
  return await prisma.station.create({
    data: {
      name: data.name,
      type: data.type,
      province: data.province,
      district: data.district,
      address: data.address,
      hotline: data.hotline,
      lat: data.lat,
      lng: data.lng,
      capacity: data.capacity || 0,
      organizationId: data.organizationId || null,
      status: data.status || "ACTIVE",
    },

    include: {
      organization: true,
    },
  });
};

// Update station
const updateStation = async (id, data) => {
  const station = await prisma.station.findUnique({
    where: { id },
  });

  if (!station) {
    throw new Error("Station not found");
  }

  return await prisma.station.update({
    where: { id },

    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.province !== undefined && { province: data.province }),
      ...(data.district !== undefined && { district: data.district }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.hotline !== undefined && { hotline: data.hotline }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.capacity !== undefined && {
        capacity: data.capacity,
      }),
      ...(data.organizationId !== undefined && {
        organizationId: data.organizationId,
      }),
      ...(data.status !== undefined && {
        status: data.status,
      }),
    },

    include: {
      organization: true,
    },
  });
};

// Delete station
const deleteStation = async (id) => {
  const station = await prisma.station.findUnique({
    where: { id },
  });

  if (!station) {
    throw new Error("Station not found");
  }

  return await prisma.station.delete({
    where: { id },
  });
};

// Change station status
const updateStationStatus = async (id, status) => {
  return await prisma.station.update({
    where: { id },

    data: {
      status,
    },
  });
};

module.exports = {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  updateStationStatus,
};