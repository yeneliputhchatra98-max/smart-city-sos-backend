const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const sanitizeUser = (user) => {
    const {
        password,
        ...safeUser
    } = user;
    return safeUser;
};

// ========================
// GET ALL USERS
// ========================
exports.getAllUsers = async (req, res, next) => {
    try {
        const users =
            await prisma.user.findMany({
                include: {
                    role: true,
                    organization: true
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
        res.json({
            success: true,
            data: users.map(sanitizeUser)
        });
    } catch (error) {
        next(error);
    }
};
// ========================
// GET USER BY ID
// ========================
exports.getUserById = async (req, res, next) => {
    try {
        const user =
            await prisma.user.findUnique({
                where: {
                    id: Number(req.params.id)
                },
                include: {
                    role: true,
                    organization: true
                }
            });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.json({
            success: true,
            data: sanitizeUser(user)
        });

    } catch (error) {
        next(error);
    }
};
// ========================
// CREATE USER
// ========================
exports.createUser = async (req, res, next) => {
    try {

        const {
            fullName,
            username,
            email,
            password,
            phone,
            roleId,
            organizationId,
            badgeId
        } = req.body;


        const existEmail = await prisma.user.findUnique({
            where: { email }
        });

        if (existEmail) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        const existUsername = await prisma.user.findUnique({
            where: { username }
        });

        if (existUsername) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        const hashPassword = await bcrypt.hash(password, 10);


        const user = await prisma.user.create({

            data: {

                fullName,

                username,

                email,

                phone,

                password: hashPassword,


                role: {
                    connect: {
                        id: Number(roleId)
                    }
                },


                organization: organizationId
                    ? {
                        connect: {
                            id: Number(organizationId)
                        }
                    }
                    : undefined,


                badgeId: badgeId || "N/A"

            },


            include: {
                role: true,
                organization: true
            }

        });



        res.status(201).json({

            success: true,

            data: sanitizeUser(user)

        });


    } catch (error) {

        next(error);

    }
};
// ========================
// UPDATE USER
// ========================
exports.updateUser = async (req, res, next) => {
    try {
        const data = {
            ...req.body
        };
        if (data.password) {
            data.password =
                await bcrypt.hash(
                    data.password,
                    10
                );
        }

        if (data.roleId) {
            data.roleId =
                Number(data.roleId);
        }
        if (data.organizationId) {
            data.organizationId = Number(data.organizationId);
        }
        const user =
            await prisma.user.update({
                where: {
                    id: req.params.id
                },
                data,
                include: {
                    role: true,
                    organization: true
                }
            });
        res.json({
            success: true,
            data: sanitizeUser(user)
        });
    } catch (error) {
        next(error);
    }
};
// ========================
// DELETE USER
// ========================
exports.deleteUser = async (req, res, next) => {
    try {

        if (req.user.id === Number(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        await prisma.user.delete({
            where: {
                id: Number(req.params.id)
            }
        });

        res.json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (error) {
        next(error);
    }
};
// ========================
// BLOCK / UNBLOCK USER
// ========================
exports.blockUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // មិនអនុញ្ញាតឱ្យ Block Account ខ្លួនឯង
        if (req.user.id === Number(id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot block your own account."
            });
        }
        // Validate status
        if (!["ACTIVE", "BLOCKED"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }
        const user = await prisma.user.update({
            where: {
                id: Number(id)
            },
            data: {
                status
            },
            include: {
                role: true,
                organization: true
            }
        });

        res.json({
            success: true,
            message: `User ${status}`,
            data: sanitizeUser(user)
        });

    } catch (error) {
        next(error);
    }
};