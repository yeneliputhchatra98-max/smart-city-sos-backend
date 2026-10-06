// controllers/user.controller.js
const userService = require("../services/user.service");

const sanitizeUser = ({ password, ...safe }) => safe;

exports.getAllUsers = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = await userService.getAllUsers({ page, limit });

        res.json({
            success: true,
            data: result.data.map(sanitizeUser),
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: Math.ceil(result.total / result.limit),
            },
        });
    } catch (error) { next(error); }
};

exports.getUserById = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) { next(error); }
};

exports.createUser = async (req, res, next) => {   // ✅ បន្ថែម file
    try {
        const user = await userService.createUser(req.body, req.file);
        res.status(201).json({ success: true, data: sanitizeUser(user) });
    } catch (error) { next(error); }
};

exports.updateUser = async (req, res, next) => {   // ✅ បន្ថែម file
    try {
        const user = await userService.updateUser(req.params.id, req.body, req.file);
        res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) { next(error); }
};

exports.deleteUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (req.user.id === req.params.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account.",
            });
        }

        // ✅ លុប parameter ទី ២
        await userService.deleteUser(req.params.id);

        res.json({ success: true, message: "User deleted successfully." });
    } catch (error) { next(error); }
};

exports.restoreUser = async (req, res, next) => {
    try {
        const user = await userService.restoreUser(req.params.id);
        res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) { next(error); }
};

exports.blockUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { id } = req.params;
        const { status } = req.body;

        if (req.user.id === id) {
            return res.status(400).json({
                success: false,
                message: "You cannot block your own account.",
            });
        }

        const user = await userService.setStatus(id, status);
        res.json({
            success: true,
            message: `User ${status}`,
            data: sanitizeUser(user),
        });
    } catch (error) { next(error); }
};

exports.getDeletedUsers = async (req, res, next) => {
    try {
        const users = await userService.getDeletedUsers();
        res.json({ success: true, data: users.map(sanitizeUser) });
    } catch (error) { next(error); }
};

exports.getMe = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) { next(error); }
};