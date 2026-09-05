const organizationService = require("../services/org.service");

// Get all organizations
exports.getAllOrgs = async (req, res, next) => {
    try {
        const orgs = await organizationService.getAllOrgs();

        res.status(200).json({
            success: true,
            data: orgs
        });

    } catch (err) {
        next(err);
    }
};

// Create organization
exports.createOrg = async (req, res, next) => {
    try {

        const org = await organizationService.createOrg(req.body);

        res.status(201).json({
            success: true,
            message: "Organization created successfully",
            data: org
        });

    } catch (err) {
        next(err);
    }
};

// Update organization
exports.updateOrg = async (req, res, next) => {
    try {

        const org = await organizationService.updateOrg(
            req.params.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Organization updated successfully",
            data: org
        });

    } catch (err) {
        next(err);
    }
};

// Delete organization
exports.deleteOrg = async (req, res, next) => {
    try {

        await organizationService.deleteOrg(req.params.id);

        res.status(200).json({
            success: true,
            message: "Organization deleted successfully"
        });

    } catch (err) {
        next(err);
    }
};

exports.getOrgById = async (req, res, next) => {
    try {

        const org = await organizationService.getOrgById(
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: org
        });

    } catch (err) {
        next(err);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {

        const org = await organizationService.updateStatus(
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            message: "Organization status updated",
            data: org
        });

    } catch (err) {
        next(err);
    }
};