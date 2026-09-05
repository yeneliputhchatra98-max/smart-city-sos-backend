const express = require('express');
const router = express.Router();

const newsController = require('../controllers/news.controller');

const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const { validateRequest } = require("../middleware/validator");
const { createNewsSchema } = require('../validators/news.validator');


// Public - មើលព័ត៌មាន
router.get(
    '/',
    newsController.getNews
);


router.get(
    '/:id',
    newsController.getNewsById
);


// Admin create news
router.post(
    '/',
    verifyToken,
    checkRole(['ADMIN']),
    validateRequest(createNewsSchema),
    newsController.createNews
);


// Admin update news
router.put(
    '/:id',
    verifyToken,
    checkRole(['ADMIN']),
    validateRequest(createNewsSchema),
    newsController.updateNews
);


// Admin delete news
router.delete(
    '/:id',
    verifyToken,
    checkRole(['ADMIN']),
    newsController.deleteNews
);


module.exports = router;