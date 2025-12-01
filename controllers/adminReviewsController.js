const Booking = require("../models/Booking");
const User = require("../models/User");

// List reviews across bookings with filters
exports.listReviews = async (req, res, next) => {
  try {
    const {
      stars,
      fromDate,
      toDate,
      hasComment,
      page = 1,
      limit = 20,
    } = req.query;

    // Build aggregation pipeline
    const match = { "reviews.0": { $exists: true } };

    const pipeline = [
      { $match: match },
      { $unwind: "$reviews" },
      // Exclude soft-deleted reviews
      { $match: { "reviews.deleted": { $ne: true } } },
    ];

    if (stars) {
      pipeline.push({ $match: { "reviews.rating": Number(stars) } });
    }

    if (hasComment === "true") {
      pipeline.push({
        $match: { "reviews.comment": { $exists: true, $ne: "" } },
      });
    } else if (hasComment === "false") {
      pipeline.push({
        $match: {
          $or: [
            { "reviews.comment": { $exists: false } },
            { "reviews.comment": "" },
          ],
        },
      });
    }

    if (fromDate || toDate) {
      const dateMatch = {};
      if (fromDate) dateMatch.$gte = new Date(fromDate);
      if (toDate) dateMatch.$lte = new Date(toDate);
      pipeline.push({ $match: { "reviews.createdAt": dateMatch } });
    }

    // Lookup customer info
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "reviews.clientId",
        foreignField: "_id",
        as: "client",
      },
    });

    pipeline.push({
      $addFields: {
        client: { $arrayElemAt: ["$client", 0] },
      },
    });

    // Project response
    pipeline.push({
      $project: {
        bookingId: "$_id",
        reviewId: "$reviews._id",
        rating: "$reviews.rating",
        comment: "$reviews.comment",
        createdAt: "$reviews.createdAt",
        hidden: "$reviews.hidden",
        deleted: "$reviews.deleted",
        history: "$reviews.history",
        clientId: "$reviews.clientId",
        clientName: "$client.name",
        serviceType: "$serviceType",
        mechanicId: "$mechanicId",
      },
    });

    // Sort by createdAt desc
    pipeline.push({ $sort: { createdAt: -1 } });

    // Facet for pagination
    pipeline.push({
      $facet: {
        data: [
          { $skip: (Number(page) - 1) * Number(limit) },
          { $limit: Number(limit) },
        ],
        total: [{ $count: "count" }],
      },
    });

    const results = await Booking.aggregate(pipeline);
    const data = results[0] && results[0].data ? results[0].data : [];
    const total =
      results[0] && results[0].total && results[0].total[0]
        ? results[0].total[0].count
        : 0;

    res.json({
      reviews: data,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing reviews for admin:", err);
    next(err);
  }
};

// Get review details
exports.getReviewDetails = async (req, res, next) => {
  try {
    const reviewId = req.params.id;

    const booking = await Booking.findOne({ "reviews._id": reviewId })
      .populate("mechanicId", "name")
      .populate("customerId", "name");

    if (!booking) return res.status(404).json({ message: "Review not found" });

    const review = booking.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    res.json({
      bookingId: booking._id,
      mechanic: booking.mechanicId,
      customer: booking.customerId,
      review,
    });
  } catch (err) {
    console.error("Error fetching review details:", err);
    next(err);
  }
};

// Soft-hide or unhide a review
exports.toggleHideReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const { hide } = req.body; // boolean

    const booking = await Booking.findOne({ "reviews._id": reviewId });
    if (!booking) return res.status(404).json({ message: "Review not found" });

    const review = booking.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.hidden = hide === true || hide === "true";
    await booking.save();

    res.json({ message: `Review ${review.hidden ? "hidden" : "visible"}` });
  } catch (err) {
    console.error("Error toggling review visibility:", err);
    next(err);
  }
};

// Soft-delete a review
exports.softDeleteReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;

    const booking = await Booking.findOne({ "reviews._id": reviewId });
    if (!booking) return res.status(404).json({ message: "Review not found" });

    const review = booking.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.deleted = true;
    await booking.save();

    res.json({ message: "Review soft-deleted" });
  } catch (err) {
    console.error("Error soft-deleting review:", err);
    next(err);
  }
};
