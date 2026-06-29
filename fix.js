const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://estately:h3Fzhb7h4uDoQjQh@ac-ul93bsg-shard-00-00.hpsrrzh.mongodb.net:27017,ac-ul93bsg-shard-00-01.hpsrrzh.mongodb.net:27017,ac-ul93bsg-shard-00-02.hpsrrzh.mongodb.net:27017/?ssl=true&replicaSet=atlas-11tf88-shard-0&authSource=admin&appName=Cluster0');

async function run() {
  try {
    await client.connect();
    const db = client.db('Estately');
    
    // Update properties
    const propRes = await db.collection('properties').updateMany(
      { ownerId: "1" },
      { $set: { ownerId: "6a3a2d5e66432b7bfa889a31" } }
    );
    console.log(`Updated ${propRes.modifiedCount} properties`);

    // Update bookings
    const bookRes = await db.collection('bookings').updateMany(
      { ownerId: "1" },
      { $set: { ownerId: "6a3a2d5e66432b7bfa889a31" } }
    );
    console.log(`Updated ${bookRes.modifiedCount} bookings`);

  } finally {
    await client.close();
  }
}

run().catch(console.error);
