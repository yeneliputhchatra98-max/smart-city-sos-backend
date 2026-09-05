const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getNews = async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = {};
    if (status) where.status = status.toUpperCase();
    if (category) where.category = category;

    const newsList = await prisma.news.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: newsList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const article = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!article) return res.status(404).json({ success: false, message: 'News article not found' });
    res.json({ success: true, data: article });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createNews = async (req, res, next) => {
  try {

    const {
      title,
      category,
      summary,
      content,
      coverUrl,
      status
    } = req.body;


    const slug = title
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-') 
      + '-' + Date.now();


    const news = await prisma.news.create({

      data: {

        title,

        slug,

        category: category || "General",

        summary: summary || "",

        content,

        status: status?.toUpperCase() || "PUBLISHED",

        coverUrl: coverUrl || "",

        publishedAt: new Date()

      }

    });


    res.status(201).json({
      success:true,
      data:news
    });


  } catch(err){

    next(err);

  }
};

exports.updateNews = async (req, res) => {
  try {
    const { title, titleEn, category, categoryEn, summary, summaryEn, content, coverUrl, status } = req.body;
    const updated = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        title,
        titleEn,
        category,
        categoryEn,
        summary,
        summaryEn,
        content,
        coverUrl,
        status: status ? status.toUpperCase() : undefined,
      }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
