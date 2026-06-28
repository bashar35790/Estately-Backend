const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db('Estately');
    const propertiesCollection = database.collection('properties');
    const bookingsCollection = database.collection('bookings');
    const reviewsCollection = database.collection('reviews');

    // post api
    app.post("/api/add-properties", async (req, res) => {
      const property = req.body;
      const result = await propertiesCollection.insertOne(property);
      res.send(result);
    })

    app.post("/api/add-review", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    })

    // get api

    app.get("/api/properties", async (req, res) => {
      const cursor = propertiesCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get("/api/properties", async (req, res) => {
      const query = {};
      if (req.query.ownerId) {
        query.ownerId = req.query.ownerId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      const cursor = propertiesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/api/properties/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await propertiesCollection.findOne(query);
      res.send(result);
    })

    app.get("/api/reviews", async (req, res) => {
      const query = {};
      if (req.query.propertyId) {
        query.propertyId = req.query.propertyId;
      }
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })




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
          const existingBooking = await bookingsCollection.findOne({ transactionId });
          if (existingBooking) {
            return res.status(409).send({ message: "Booking for this transaction already exists" });
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
        res.status(500).send({ message: "Failed to create booking", error: err.message });
      }
    });

    // GET /api/bookings (for tenant or owner)
    app.get("/api/bookings", async (req, res) => {
      try {
        const query = {};
        if (req.query.tenantId) query.tenantId = req.query.tenantId;
        if (req.query.ownerId) query.ownerId = req.query.ownerId;
        if (req.query.propertyId) query.propertyId = req.query.propertyId;
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch bookings", error: err.message });
      }
    });

    const favoritesCollection = database.collection('favorites');

    // POST /api/favorites
    app.post("/api/favorites", async (req, res) => {
      try {
        const { propertyId, userId } = req.body;
        if (!propertyId || !userId) {
          return res.status(400).send({ message: "propertyId and userId are required" });
        }

        const existing = await favoritesCollection.findOne({ propertyId, userId });
        if (existing) {
          return res.status(409).send({ message: "Property already in favorites" });
        }

        const favorite = {
          propertyId,
          userId,
          createdAt: new Date().toISOString()
        };

        const result = await favoritesCollection.insertOne(favorite);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to add favorite", error: err.message });
      }
    });

    // DELETE /api/favorites/:propertyId
    app.delete("/api/favorites/:propertyId", async (req, res) => {
      try {
        const propertyId = req.params.propertyId;
        const userId = req.query.userId;
        
        if (!propertyId || !userId) {
          return res.status(400).send({ message: "propertyId and userId are required" });
        }

        const result = await favoritesCollection.deleteOne({ propertyId, userId });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Favorite not found" });
        }
        res.send({ message: "Favorite removed successfully" });
      } catch (err) {
        res.status(500).send({ message: "Failed to remove favorite", error: err.message });
      }
    });

    // GET /api/favorites/check/:propertyId
    app.get("/api/favorites/check/:propertyId", async (req, res) => {
      try {
        const propertyId = req.params.propertyId;
        const userId = req.query.userId;
        
        if (!propertyId || !userId) {
          return res.status(400).send({ message: "propertyId and userId are required" });
        }

        const existing = await favoritesCollection.findOne({ propertyId, userId });
        res.send({ isFavorite: !!existing });
      } catch (err) {
        res.status(500).send({ message: "Failed to check favorite status", error: err.message });
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
        const propertyIds = favorites.map(fav => new ObjectId(fav.propertyId));
        const properties = await propertiesCollection.find({ _id: { $in: propertyIds } }).toArray();
        
        res.send(properties);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch favorites", error: err.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running')
})

app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`)
})
