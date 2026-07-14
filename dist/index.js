"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
node_dns_1.default.setServers(["8.8.8.8", "8.8.4.4"]);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("mongodb");
const app = (0, express_1.default)();
dotenv_1.default.config();
// middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((0, cors_1.default)({ origin: process.env.BETTER_AUTH_URL, credentials: true }));
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
// env variables
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new mongodb_1.MongoClient(uri, {
    serverApi: {
        version: mongodb_1.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Connect the client to the server (optional starting in v4.7)
            yield client.connect();
            const database = client.db("Estately");
            const propertiesCollection = database.collection("properties");
            const bookingsCollection = database.collection("bookings");
            const reviewsCollection = database.collection("reviews");
            const favoritesCollection = database.collection("favorites");
            const usersCollection = database.collection("user");
            const enrichBookings = (bookings) => __awaiter(this, void 0, void 0, function* () {
                const propertyIds = [
                    ...new Set(bookings
                        .map((booking) => booking.propertyId)
                        .filter((id) => mongodb_1.ObjectId.isValid(id))),
                ].map((id) => new mongodb_1.ObjectId(id));
                const userIds = [
                    ...new Set(bookings.flatMap((booking) => [booking.tenantId, booking.ownerId]).filter(Boolean)),
                ];
                const [properties, users] = yield Promise.all([
                    propertyIds.length
                        ? propertiesCollection.find({ _id: { $in: propertyIds } }).toArray()
                        : [],
                    userIds.length ? usersCollection.find({ id: { $in: userIds } }).toArray() : [],
                ]);
                const propertyMap = new Map(properties.map((property) => [property._id.toString(), property]));
                const userMap = new Map(users.map((user) => [user.id, user]));
                return bookings.map((booking) => {
                    const property = propertyMap.get(booking.propertyId);
                    const tenant = userMap.get(booking.tenantId);
                    const owner = userMap.get(booking.ownerId);
                    return Object.assign(Object.assign({}, booking), { propertyTitle: (property === null || property === void 0 ? void 0 : property.title) || "", propertyName: (property === null || property === void 0 ? void 0 : property.title) || "", tenantName: (tenant === null || tenant === void 0 ? void 0 : tenant.name) || "", tenantEmail: (tenant === null || tenant === void 0 ? void 0 : tenant.email) || "", ownerName: (owner === null || owner === void 0 ? void 0 : owner.name) || (property === null || property === void 0 ? void 0 : property.ownerName) || "", ownerEmail: (owner === null || owner === void 0 ? void 0 : owner.email) || (property === null || property === void 0 ? void 0 : property.ownerEmail) || "" });
                });
            });
            // post api
            app.post("/api/send-email", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const { email, name } = req.query;
                console.log(`Sending email to ${email} for user ${name}`);
                res.send({ message: "Email logged" });
            }));
            app.post("/api/add-properties", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const property = req.body;
                const result = yield propertiesCollection.insertOne(property);
                res.send(result);
            }));
            app.post("/api/add-review", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const review = req.body;
                const result = yield reviewsCollection.insertOne(review);
                res.send(result);
            }));
            // get api
            app.get("/api/properties", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const query = {};
                    // Exact match filters
                    if (req.query.ownerId)
                        query.ownerId = req.query.ownerId;
                    if (req.query.status)
                        query.status = req.query.status;
                    if (req.query.propertyType) {
                        query.propertyType = { $regex: new RegExp(`^${req.query.propertyType}$`, 'i') };
                    }
                    // Search by location (case-insensitive regex)
                    if (req.query.location) {
                        query.location = { $regex: req.query.location, $options: "i" };
                    }
                    // Price range filtering
                    if (req.query.minPrice || req.query.maxPrice) {
                        query.price = {};
                        if (req.query.minPrice)
                            query.price.$gte = Number(req.query.minPrice);
                        if (req.query.maxPrice)
                            query.price.$lte = Number(req.query.maxPrice);
                    }
                    let cursor = propertiesCollection.find(query);
                    // Apply limit if provided
                    if (req.query.limit) {
                        cursor = cursor.limit(Number(req.query.limit));
                    }
                    const result = yield cursor.toArray();
                    res.send(result);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch properties", error: err.message });
                }
            }));
            app.get("/api/properties/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const id = req.params.id;
                const query = {
                    _id: new mongodb_1.ObjectId(id),
                };
                const result = yield propertiesCollection.findOne(query);
                res.send(result);
            }));
            app.get("/api/all-reviews", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield reviewsCollection
                        .find({})
                        .sort({ createdAt: -1 }) // Newest first
                        .limit(6)
                        .toArray();
                    res.send(result);
                }
                catch (error) {
                    res.status(500).send({ message: "Failed to fetch reviews" });
                }
            }));
            app.get("/api/reviews", (req, res) => __awaiter(this, void 0, void 0, function* () {
                const query = {};
                if (req.query.propertyId) {
                    query.propertyId = req.query.propertyId;
                }
                const cursor = reviewsCollection.find(query);
                const result = yield cursor.toArray();
                res.send(result);
            }));
            // POST /api/bookings
            app.post("/api/bookings", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const { propertyId, tenantId, ownerId, moveInDate, contactNumber, notes, amount, bookingStatus, paymentStatus, transactionId, } = req.body;
                    // Prevent duplicate bookings if a transaction ID is provided
                    if (transactionId) {
                        const existingBooking = yield bookingsCollection.findOne({
                            transactionId,
                        });
                        if (existingBooking) {
                            res.status(409).send({ message: "Booking for this transaction already exists" });
                            return;
                        }
                    }
                    const booking = {
                        propertyId,
                        tenantId,
                        ownerId,
                        moveInDate,
                        contactNumber,
                        notes: notes || "",
                        amount,
                        bookingStatus: bookingStatus || "pending",
                        paymentStatus: paymentStatus || "paid",
                        transactionId: transactionId || "",
                        createdAt: new Date().toISOString(),
                    };
                    const result = yield bookingsCollection.insertOne(booking);
                    res.status(201).send(result);
                }
                catch (err) {
                    res
                        .status(500)
                        .send({ message: "Failed to create booking", error: err.message });
                }
            }));
            // GET /api/bookings (for tenant or owner)
            app.get("/api/bookings", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const query = {};
                    if (req.query.tenantId)
                        query.tenantId = req.query.tenantId;
                    if (req.query.ownerId)
                        query.ownerId = req.query.ownerId;
                    if (req.query.propertyId)
                        query.propertyId = req.query.propertyId;
                    const result = yield bookingsCollection.find(query).sort({ createdAt: -1 }).toArray();
                    if (req.query.includeDetails === "true") {
                        const enriched = yield enrichBookings(result);
                        res.send(enriched);
                        return;
                    }
                    res.send(result);
                }
                catch (err) {
                    res
                        .status(500)
                        .send({ message: "Failed to fetch bookings", error: err.message });
                }
            }));
            // POST /api/favorites
            app.post("/api/favorites", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const { propertyId, userId } = req.body;
                    if (!propertyId || !userId) {
                        res.status(400).send({ message: "propertyId and userId are required" });
                        return;
                    }
                    const existing = yield favoritesCollection.findOne({
                        propertyId,
                        userId,
                    });
                    if (existing) {
                        res.status(409).send({ message: "Property already in favorites" });
                        return;
                    }
                    const favorite = {
                        propertyId,
                        userId,
                        createdAt: new Date().toISOString(),
                    };
                    const result = yield favoritesCollection.insertOne(favorite);
                    res.status(201).send(result);
                }
                catch (err) {
                    res
                        .status(500)
                        .send({ message: "Failed to add favorite", error: err.message });
                }
            }));
            // DELETE /api/favorites/:propertyId
            app.delete("/api/favorites/:propertyId", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const propertyId = req.params.propertyId;
                    const userId = req.query.userId;
                    if (!propertyId || !userId) {
                        res.status(400).send({ message: "propertyId and userId are required" });
                        return;
                    }
                    const result = yield favoritesCollection.deleteOne({
                        propertyId,
                        userId,
                    });
                    if (result.deletedCount === 0) {
                        res.status(404).send({ message: "Favorite not found" });
                        return;
                    }
                    res.send({ message: "Favorite removed successfully" });
                }
                catch (err) {
                    res
                        .status(500)
                        .send({ message: "Failed to remove favorite", error: err.message });
                }
            }));
            // GET /api/favorites/check/:propertyId
            app.get("/api/favorites/check/:propertyId", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const propertyId = req.params.propertyId;
                    const userId = req.query.userId;
                    if (!propertyId || !userId) {
                        res.status(400).send({ message: "propertyId and userId are required" });
                        return;
                    }
                    const existing = yield favoritesCollection.findOne({
                        propertyId,
                        userId,
                    });
                    res.send({ isFavorite: !!existing });
                }
                catch (err) {
                    res.status(500).send({
                        message: "Failed to check favorite status",
                        error: err.message,
                    });
                }
            }));
            // GET /api/favorites
            app.get("/api/favorites", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const userId = req.query.userId;
                    if (!userId) {
                        res.status(400).send({ message: "userId is required" });
                        return;
                    }
                    // Fetch favorites
                    const favorites = yield favoritesCollection.find({ userId }).toArray();
                    // Fetch property details for each favorite
                    const propertyIds = favorites.map((fav) => new mongodb_1.ObjectId(fav.propertyId));
                    const properties = yield propertiesCollection
                        .find({ _id: { $in: propertyIds } })
                        .toArray();
                    res.send(properties);
                }
                catch (err) {
                    res
                        .status(500)
                        .send({ message: "Failed to fetch favorites", error: err.message });
                }
            }));
            // DELETE /api/properties/:id
            app.delete("/api/properties/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const id = req.params.id;
                    const result = yield propertiesCollection.deleteOne({ _id: new mongodb_1.ObjectId(id) });
                    if (result.deletedCount === 0) {
                        res.status(404).send({ message: "Property not found" });
                        return;
                    }
                    res.send({ message: "Property deleted successfully" });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to delete property", error: err.message });
                }
            }));
            // PATCH /api/bookings/:id/status
            app.patch("/api/bookings/:id/status", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const id = req.params.id;
                    const { status } = req.body;
                    if (!status) {
                        res.status(400).send({ message: "status is required" });
                        return;
                    }
                    const result = yield bookingsCollection.updateOne({ _id: new mongodb_1.ObjectId(id) }, { $set: { bookingStatus: status } });
                    res.send(result);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to update booking status", error: err.message });
                }
            }));
            // PATCH /api/properties/:id/status
            app.patch("/api/properties/:id/status", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const id = req.params.id;
                    const { status, rejectionFeedback = "" } = req.body;
                    if (!status) {
                        res.status(400).send({ message: "status is required" });
                        return;
                    }
                    const update = {
                        status,
                        rejectionFeedback: status === "rejected" ? rejectionFeedback : "",
                    };
                    const result = yield propertiesCollection.updateOne({ _id: new mongodb_1.ObjectId(id) }, { $set: update });
                    if (result.matchedCount === 0) {
                        res.status(404).send({ message: "Property not found" });
                        return;
                    }
                    res.send({ message: "Property status updated", status, rejectionFeedback: update.rejectionFeedback });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to update property status", error: err.message });
                }
            }));
            app.get("/api/admin/stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const [totalUsers, totalProperties, totalBookings, pendingProperties, confirmedBookings] = yield Promise.all([
                        usersCollection.countDocuments(),
                        propertiesCollection.countDocuments(),
                        bookingsCollection.countDocuments(),
                        propertiesCollection.countDocuments({ status: "pending" }),
                        bookingsCollection.countDocuments({ bookingStatus: { $in: ["confirmed", "approved"] } }),
                    ]);
                    const paidBookings = yield bookingsCollection.find({ paymentStatus: "paid" }).toArray();
                    const totalRevenue = paidBookings.reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);
                    res.send({
                        totalUsers,
                        totalProperties,
                        totalBookings,
                        pendingProperties,
                        confirmedBookings,
                        totalRevenue,
                    });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch admin stats", error: err.message });
                }
            }));
            app.get("/api/admin/users", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const users = yield usersCollection.find({}).sort({ createdAt: -1 }).toArray();
                    res.send(users);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch users", error: err.message });
                }
            }));
            app.patch("/api/admin/users/:id/role", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const id = req.params.id;
                    const { userRole } = req.body;
                    if (!userRole) {
                        res.status(400).send({ message: "userRole is required" });
                        return;
                    }
                    const result = yield usersCollection.updateOne({ id }, { $set: { userRole } });
                    if (result.matchedCount === 0) {
                        res.status(404).send({ message: "User not found" });
                        return;
                    }
                    res.send({ message: "User role updated", userRole });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to update user role", error: err.message });
                }
            }));
            app.get("/api/admin/properties", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const query = {};
                    if (req.query.status) {
                        query.status = req.query.status;
                    }
                    const properties = yield propertiesCollection.find(query).sort({ _id: -1 }).toArray();
                    res.send(properties);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch admin properties", error: err.message });
                }
            }));
            app.patch("/api/admin/properties/:id", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const id = req.params.id;
                    const allowedFields = [
                        "title",
                        "location",
                        "propertyType",
                        "price",
                        "rentType",
                        "status",
                        "bedrooms",
                        "bathrooms",
                        "size",
                        "isFeatured",
                        "rejectionFeedback",
                    ];
                    const update = {};
                    for (const field of allowedFields) {
                        if (req.body[field] !== undefined) {
                            update[field] = req.body[field];
                        }
                    }
                    if (Object.keys(update).length === 0) {
                        res.status(400).send({ message: "No valid fields to update" });
                        return;
                    }
                    if (update.status && update.status !== "rejected") {
                        update.rejectionFeedback = "";
                    }
                    const result = yield propertiesCollection.updateOne({ _id: new mongodb_1.ObjectId(id) }, { $set: update });
                    if (result.matchedCount === 0) {
                        res.status(404).send({ message: "Property not found" });
                        return;
                    }
                    res.send({ message: "Property updated successfully" });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to update property", error: err.message });
                }
            }));
            app.get("/api/admin/bookings", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bookings = yield bookingsCollection.find({}).sort({ createdAt: -1 }).toArray();
                    const enriched = yield enrichBookings(bookings);
                    res.send(enriched);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch admin bookings", error: err.message });
                }
            }));
            app.get("/api/admin/transactions", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bookings = yield bookingsCollection
                        .find({ transactionId: { $ne: "" }, paymentStatus: "paid" })
                        .sort({ createdAt: -1 })
                        .toArray();
                    const enriched = yield enrichBookings(bookings);
                    const transactions = enriched.map((booking) => ({
                        _id: booking._id,
                        transactionId: booking.transactionId,
                        propertyName: booking.propertyTitle || "",
                        tenantName: booking.tenantName || "",
                        ownerName: booking.ownerName || "",
                        amount: Number(booking.amount) || 0,
                        date: booking.createdAt,
                    }));
                    res.send(transactions);
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch transactions", error: err.message });
                }
            }));
            app.get("/api/tenant-stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const tenantId = req.query.tenantId;
                    if (!tenantId) {
                        res.status(400).send({ message: "tenantId is required" });
                        return;
                    }
                    const [bookings, favoritesCount] = yield Promise.all([
                        bookingsCollection.find({ tenantId }).toArray(),
                        favoritesCollection.countDocuments({ userId: tenantId }),
                    ]);
                    const totalBookings = bookings.length;
                    const activeBookings = bookings.filter((booking) => ["confirmed", "approved", "pending"].includes(booking.bookingStatus)).length;
                    const totalPaid = bookings
                        .filter((booking) => booking.paymentStatus === "paid")
                        .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);
                    res.send({
                        totalBookings,
                        activeBookings,
                        favoriteProperties: favoritesCount,
                        totalPaid,
                    });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch tenant stats", error: err.message });
                }
            }));
            // GET /api/owner-stats
            app.get("/api/owner-stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const ownerId = req.query.ownerId;
                    if (!ownerId) {
                        res.status(400).send({ message: "ownerId is required" });
                        return;
                    }
                    // 1. Total Properties
                    const totalProperties = yield propertiesCollection.countDocuments({ ownerId });
                    // 2. Fetch all bookings for the owner
                    const bookings = yield bookingsCollection.find({ ownerId }).toArray();
                    // 3. Total Bookings (Confirmed)
                    // Assuming "confirmed" bookings or "paid" paymentStatus
                    const totalBookings = bookings.filter((b) => b.bookingStatus === "confirmed" || b.paymentStatus === "paid" || b.bookingStatus === "approved").length;
                    // 4. Total Earnings
                    let totalEarnings = 0;
                    const paidBookings = bookings.filter((b) => b.paymentStatus === "paid");
                    paidBookings.forEach((b) => {
                        totalEarnings += Number(b.amount) || 0;
                    });
                    // 5. Monthly Earnings Chart Data for the last 12 months
                    const monthlyEarningsMap = {};
                    const now = new Date();
                    // Initialize last 12 months with 0
                    for (let i = 11; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const monthName = d.toLocaleString('default', { month: 'short' });
                        monthlyEarningsMap[monthName] = 0;
                    }
                    paidBookings.forEach((b) => {
                        if (b.createdAt) {
                            const bDate = new Date(b.createdAt);
                            // Check if within last 12 months
                            const diffTime = Math.abs(now.getTime() - bDate.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays <= 365) {
                                const mName = bDate.toLocaleString('default', { month: 'short' });
                                if (monthlyEarningsMap[mName] !== undefined) {
                                    monthlyEarningsMap[mName] += Number(b.amount) || 0;
                                }
                            }
                        }
                    });
                    const monthlyEarnings = Object.keys(monthlyEarningsMap).map(key => ({
                        name: key,
                        total: monthlyEarningsMap[key]
                    }));
                    res.send({
                        totalEarnings,
                        totalProperties,
                        totalBookings,
                        monthlyEarnings
                    });
                }
                catch (err) {
                    res.status(500).send({ message: "Failed to fetch owner stats", error: err.message });
                }
            }));
        }
        finally {
            // Ensures that the client will close when you finish/error
            // await client.close();
        }
    });
}
run().catch(console.dir);
app.get("/", (req, res) => {
    res.send("server is running");
});
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`server is running on http://localhost:${port}`);
    });
}
exports.default = app;
