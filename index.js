const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(express.json());
app.use(cors());

// env variables
const port = process.env.PORT;
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("Estately");
    const propertiesCollection = database.collection("properties");
    const bookingsCollection = database.collection("bookings");
    const reviewsCollection = database.collection("reviews");
    const favoritesCollection = database.collection("favorites");
    const usersCollection = database.collection("user");

    const enrichBookings = async (bookings) => {
      const propertyIds = [
        ...new Set(
          bookings
            .map((booking) => booking.propertyId)
            .filter((id) => ObjectId.isValid(id)),
        ),
      ].map((id) => new ObjectId(id));

      const userIds = [
        ...new Set(
          bookings.flatMap((booking) => [booking.tenantId, booking.ownerId]).filter(Boolean),
        ),
      ];

      const [properties, users] = await Promise.all([
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

        return {
          ...booking,
          propertyTitle: property?.title || "",
          propertyName: property?.title || "",
          tenantName: tenant?.name || "",
          tenantEmail: tenant?.email || "",
          ownerName: owner?.name || property?.ownerName || "",
          ownerEmail: owner?.email || property?.ownerEmail || "",
        };
      });
    };

    // post api
    app.post("/api/add-properties", async (req, res) => {
      const property = req.body;
      const result = await propertiesCollection.insertOne(property);
      res.send(result);
    });

    app.post("/api/add-review", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // get api

    app.get("/api/properties", async (req, res) => {
      try {
        const query = {};
        
        // Exact match filters
        if (req.query.ownerId) query.ownerId = req.query.ownerId;
        if (req.query.status) query.status = req.query.status;
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
          if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
          if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
        }

        let cursor = propertiesCollection.find(query);

        // Apply limit if provided
        if (req.query.limit) {
          cursor = cursor.limit(Number(req.query.limit));
        }

        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch properties", error: err.message });
      }
    });

    app.get("/api/properties/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await propertiesCollection.findOne(query);
      res.send(result);
    });

    app.get("/api/reviews", async (req, res) => {
      const query = {};
      if (req.query.propertyId) {
        query.propertyId = req.query.propertyId;
      }
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // POST /api/bookings
    app.post("/api/bookings", async (req, res) => {
      try {
        const {
          propertyId,
          tenantId,
          ownerId,
          moveInDate,
          contactNumber,
          notes,
          amount,
          bookingStatus,
          paymentStatus,
          transactionId,
        } = req.body;

        // Prevent duplicate bookings if a transaction ID is provided
        if (transactionId) {
          const existingBooking = await bookingsCollection.findOne({
            transactionId,
          });
          if (existingBooking) {
            return res
              .status(409)
              .send({ message: "Booking for this transaction already exists" });
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

        const result = await bookingsCollection.insertOne(booking);
        res.status(201).send(result);
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to create booking", error: err.message });
      }
    });

    // GET /api/bookings (for tenant or owner)
    app.get("/api/bookings", async (req, res) => {
      try {
        const query = {};
        if (req.query.tenantId) query.tenantId = req.query.tenantId;
        if (req.query.ownerId) query.ownerId = req.query.ownerId;
        if (req.query.propertyId) query.propertyId = req.query.propertyId;
        const result = await bookingsCollection.find(query).sort({ createdAt: -1 }).toArray();

        if (req.query.includeDetails === "true") {
          const enriched = await enrichBookings(result);
          return res.send(enriched);
        }

        res.send(result);
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to fetch bookings", error: err.message });
      }
    });

    // POST /api/favorites
    app.post("/api/favorites", async (req, res) => {
      try {
        const { propertyId, userId } = req.body;
        if (!propertyId || !userId) {
          return res
            .status(400)
            .send({ message: "propertyId and userId are required" });
        }

        const existing = await favoritesCollection.findOne({
          propertyId,
          userId,
        });
        if (existing) {
          return res
            .status(409)
            .send({ message: "Property already in favorites" });
        }

        const favorite = {
          propertyId,
          userId,
          createdAt: new Date().toISOString(),
        };

        const result = await favoritesCollection.insertOne(favorite);
        res.status(201).send(result);
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to add favorite", error: err.message });
      }
    });

    // DELETE /api/favorites/:propertyId
    app.delete("/api/favorites/:propertyId", async (req, res) => {
      try {
        const propertyId = req.params.propertyId;
        const userId = req.query.userId;

        if (!propertyId || !userId) {
          return res
            .status(400)
            .send({ message: "propertyId and userId are required" });
        }

        const result = await favoritesCollection.deleteOne({
          propertyId,
          userId,
        });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Favorite not found" });
        }
        res.send({ message: "Favorite removed successfully" });
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to remove favorite", error: err.message });
      }
    });

    // GET /api/favorites/check/:propertyId
    app.get("/api/favorites/check/:propertyId", async (req, res) => {
      try {
        const propertyId = req.params.propertyId;
        const userId = req.query.userId;

        if (!propertyId || !userId) {
          return res
            .status(400)
            .send({ message: "propertyId and userId are required" });
        }

        const existing = await favoritesCollection.findOne({
          propertyId,
          userId,
        });
        res.send({ isFavorite: !!existing });
      } catch (err) {
        res.status(500).send({
          message: "Failed to check favorite status",
          error: err.message,
        });
      }
    });

    // GET /api/favorites
    app.get("/api/favorites", async (req, res) => {
      try {
        const userId = req.query.userId;
        if (!userId) {
          return res.status(400).send({ message: "userId is required" });
        }

        // Fetch favorites
        const favorites = await favoritesCollection.find({ userId }).toArray();

        // Fetch property details for each favorite
        const propertyIds = favorites.map(
          (fav) => new ObjectId(fav.propertyId),
        );
        const properties = await propertiesCollection
          .find({ _id: { $in: propertyIds } })
          .toArray();

        res.send(properties);
      } catch (err) {
        res
          .status(500)
          .send({ message: "Failed to fetch favorites", error: err.message });
      }
    });

    // DELETE /api/properties/:id
    app.delete("/api/properties/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Property not found" });
        }
        res.send({ message: "Property deleted successfully" });
      } catch (err) {
        res.status(500).send({ message: "Failed to delete property", error: err.message });
      }
    });

    // PATCH /api/bookings/:id/status
    app.patch("/api/bookings/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        if (!status) {
          return res.status(400).send({ message: "status is required" });
        }
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { bookingStatus: status } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to update booking status", error: err.message });
      }
    });

    // PATCH /api/properties/:id/status
    app.patch("/api/properties/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status, rejectionFeedback = "" } = req.body;
        if (!status) {
          return res.status(400).send({ message: "status is required" });
        }
        const update = {
          status,
          rejectionFeedback: status === "rejected" ? rejectionFeedback : "",
        };
        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: update }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Property not found" });
        }
        res.send({ message: "Property status updated", status, rejectionFeedback: update.rejectionFeedback });
      } catch (err) {
        res.status(500).send({ message: "Failed to update property status", error: err.message });
      }
    });

    app.get("/api/admin/stats", async (req, res) => {
      try {
        const [totalUsers, totalProperties, totalBookings, pendingProperties, confirmedBookings] =
          await Promise.all([
            usersCollection.countDocuments(),
            propertiesCollection.countDocuments(),
            bookingsCollection.countDocuments(),
            propertiesCollection.countDocuments({ status: "pending" }),
            bookingsCollection.countDocuments({ bookingStatus: { $in: ["confirmed", "approved"] } }),
          ]);

        const paidBookings = await bookingsCollection.find({ paymentStatus: "paid" }).toArray();
        const totalRevenue = paidBookings.reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

        res.send({
          totalUsers,
          totalProperties,
          totalBookings,
          pendingProperties,
          confirmedBookings,
          totalRevenue,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch admin stats", error: err.message });
      }
    });

    app.get("/api/admin/users", async (req, res) => {
      try {
        const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch users", error: err.message });
      }
    });

    app.patch("/api/admin/users/:id/role", async (req, res) => {
      try {
        const id = req.params.id;
        const { userRole } = req.body;

        if (!userRole) {
          return res.status(400).send({ message: "userRole is required" });
        }

        const result = await usersCollection.updateOne({ id }, { $set: { userRole } });
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ message: "User role updated", userRole });
      } catch (err) {
        res.status(500).send({ message: "Failed to update user role", error: err.message });
      }
    });

    app.get("/api/admin/properties", async (req, res) => {
      try {
        const query = {};
        if (req.query.status) {
          query.status = req.query.status;
        }

        const properties = await propertiesCollection.find(query).sort({ _id: -1 }).toArray();
        res.send(properties);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch admin properties", error: err.message });
      }
    });

    app.patch("/api/admin/properties/:id", async (req, res) => {
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
          return res.status(400).send({ message: "No valid fields to update" });
        }

        if (update.status && update.status !== "rejected") {
          update.rejectionFeedback = "";
        }

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: update },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Property not found" });
        }

        res.send({ message: "Property updated successfully" });
      } catch (err) {
        res.status(500).send({ message: "Failed to update property", error: err.message });
      }
    });

    app.get("/api/admin/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection.find({}).sort({ createdAt: -1 }).toArray();
        const enriched = await enrichBookings(bookings);
        res.send(enriched);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch admin bookings", error: err.message });
      }
    });

    app.get("/api/admin/transactions", async (req, res) => {
      try {
        const bookings = await bookingsCollection
          .find({ transactionId: { $ne: "" }, paymentStatus: "paid" })
          .sort({ createdAt: -1 })
          .toArray();

        const enriched = await enrichBookings(bookings);
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
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch transactions", error: err.message });
      }
    });

    app.get("/api/tenant-stats", async (req, res) => {
      try {
        const tenantId = req.query.tenantId;
        if (!tenantId) {
          return res.status(400).send({ message: "tenantId is required" });
        }

        const [bookings, favoritesCount] = await Promise.all([
          bookingsCollection.find({ tenantId }).toArray(),
          favoritesCollection.countDocuments({ userId: tenantId }),
        ]);

        const totalBookings = bookings.length;
        const activeBookings = bookings.filter((booking) =>
          ["confirmed", "approved", "pending"].includes(booking.bookingStatus),
        ).length;
        const totalPaid = bookings
          .filter((booking) => booking.paymentStatus === "paid")
          .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

        res.send({
          totalBookings,
          activeBookings,
          favoriteProperties: favoritesCount,
          totalPaid,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch tenant stats", error: err.message });
      }
    });

    // GET /api/owner-stats
    app.get("/api/owner-stats", async (req, res) => {
      try {
        const ownerId = req.query.ownerId;
        if (!ownerId) {
          return res.status(400).send({ message: "ownerId is required" });
        }

        // 1. Total Properties
        const totalProperties = await propertiesCollection.countDocuments({ ownerId });

        // 2. Fetch all bookings for the owner
        const bookings = await bookingsCollection.find({ ownerId }).toArray();

        // 3. Total Bookings (Confirmed)
        // Assuming "confirmed" bookings or "paid" paymentStatus
        const totalBookings = bookings.filter(
          (b) => b.bookingStatus === "confirmed" || b.paymentStatus === "paid" || b.bookingStatus === "approved"
        ).length;

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
            const diffTime = Math.abs(now - bDate);
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
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch owner stats", error: err.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});
