const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Get all users
exports.getAllUsers = async () => {

    return await prisma.user.findMany({
        include: {
            role: true,
            organization: true
        }
    });

};



// Get user by ID
exports.getUserById = async (id) => {

    return await prisma.user.findUnique({
        where: {
            id: Number(id)
        },
        include: {
            role: true,
            organization: true
        }
    });

};

// Create User (Admin create staff)
exports.createUser = async (data) => {

    const {
        fullName,
        username,
        email,
        password,
        phone,
        roleId,
        organizationId,
        badgeId
    } = data;


    // Check email duplicate
    const existUsername = await prisma.user.findUnique({
        where: {
            username
        }
    });

    if (existUsername) {
        throw new Error("Username already exists");
    }
    const existEmail = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existEmail) {
        throw new Error("Email already exists");
    }

    // Hash password
    const hashPassword = await bcrypt.hash(password, 10);


    // Create user
    const user = await prisma.user.create({
        data: {
            fullName,
            username,
            email,
            phone,
            password: hashPassword,
            roleId: Number(roleId),
            organizationId: organizationId
                ? Number(organizationId)
                : null,
            badgeId: badgeId || null
        },

        include: {
            role: true,
            organization: true
        }
    });


    return user;
};




// Update User
exports.updateUser = async (id, data) => {

    if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
    }

    if (data.roleId) {
        data.roleId = Number(data.roleId);
    }

    if (data.organizationId) {
        data.organizationId = Number(data.organizationId);
    }
    if (data.organizationId === "") {
        data.organizationId = null;
    }

    return await prisma.user.update({
        where: {
            id: Number(id)
        },
        data,
        include: {
            role: true,
            organization: true
        }
    });
};

// Delete User
exports.deleteUser = async (id) => {
    return prisma.user.delete({
        where: {
            id: Number(id)
        }
    });
};
exports.blockUser = async (id) => {

    return await prisma.user.update({
        where: {
            id: Number(id)
        },
        data: {
            status: "BLOCKED"
        }
    });

};

exports.unblockUser = async (id) => {

    return await prisma.user.update({
        where: {
            id: Number(id)
        },
        data: {
            status: "ACTIVE"
        }
    });

};