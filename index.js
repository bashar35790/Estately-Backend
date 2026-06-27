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
