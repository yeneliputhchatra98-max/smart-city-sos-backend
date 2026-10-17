const broadcastService = require("../services/broadcast.service");
 
// Get Options / Metadata
exports.getBroadcastOptions = async (req, res, next) => {
    try {
        const options = await broadcastService.getBroadcastOptions();
        res.json({
            success: true,
            data: options
        });
    } catch (err) {
        next(err);
    }
};


// Get All (Paginated + Filtered)
exports.getAllBroadcasts = async (req, res, next) => {
    try {
        const result = await broadcastService.getAllBroadcasts(req.query);

        res.status(200).json({
            success: true,
            message: "Broadcasts retrieved successfully",
            data: result.broadcasts,
            pagination: result.pagination,
            stats: result.stats
        });
    } catch (err) {
        next(err);
    }
};


// Get By ID
exports.getBroadcastById = async (req, res, next) => {

    try {

        const broadcast =
            await broadcastService.getBroadcastById(req.params.id);

        if (!broadcast) {

            return res.status(404).json({
                success: false,
                message: "Broadcast not found"
            });

        }

        res.json({
            success: true,
            data: broadcast
        });

    } catch (err) {

        next(err);

    }

};


// Create
exports.createBroadcast = async (req, res, next) => {

    try {

        const broadcast =
            await broadcastService.createBroadcast(
                req.body,
                req.user
            );

        res.status(201).json({

            success: true,
            data: broadcast

        });

    } catch (err) {

        next(err);

    }

};


// Update
exports.updateBroadcast = async (req, res, next) => {

    try {

        const broadcast =
            await broadcastService.updateBroadcast(
                req.params.id,
                req.body
            );

        res.json({

            success: true,
            data: broadcast

        });

    } catch (err) {

        next(err);

    }

};


// Update Status
exports.updateBroadcastStatus = async (req, res, next) => {

    try {

        const broadcast =
            await broadcastService.updateBroadcastStatus(
                req.params.id,
                req.body.status
            );

        res.json({

            success: true,
            data: broadcast

        });

    } catch (err) {

        next(err);

    }

};


// Delete
exports.deleteBroadcast = async (req, res, next) => {

    try {

        await broadcastService.deleteBroadcast(req.params.id);

        res.json({

            success: true,
            message: "Broadcast deleted successfully"

        });

    } catch (err) {

        next(err);

    }

};