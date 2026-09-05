const nodeCrypto = require("node:crypto");
const prisma = require("../config/prisma");

// Generate reset token
const generateResetToken = async (userId) => {
    const token = nodeCrypto
        .randomBytes(32)
        .toString("hex");

    const tokenHash = nodeCrypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
    );

    await prisma.passwordResetToken.deleteMany({
        where: {
            userId: userId,
        },
    });

    await prisma.passwordResetToken.create({
        data: {
            userId: userId,
            tokenHash: tokenHash,
            expiresAt: expiresAt,
        },
    });

    return token;
};


// Verify reset token
const verifyResetToken = async (rawToken) => {
    if (!rawToken) {
        throw new Error("Reset token is required");
    }

    const tokenHash = nodeCrypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const resetToken =
        await prisma.passwordResetToken.findUnique({
            where: {
                tokenHash: tokenHash,
            },
        });

    if (!resetToken) {
        throw new Error(
            "Invalid or expired reset token"
        );
    }

    if (resetToken.expiresAt < new Date()) {
        await prisma.passwordResetToken.delete({
            where: {
                id: resetToken.id,
            },
        });

        throw new Error(
            "Reset token has expired"
        );
    }

    console.log("FOUND RESET TOKEN:", resetToken);

    return resetToken;
};


module.exports = {
    generateResetToken,
    verifyResetToken,
};