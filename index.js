import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  MongoClient,
  ServerApiVersion,
} from 'mongodb';
import { mongo } from 'mongoose';

dotenv.config();
const app = express();
app.use(cors());
const port = 5000;
const nodeEnv = process.env.MONGO_URI;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const uri = nodeEnv;
console.log(uri);
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const connectWithRetry = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    setTimeout(connectWithRetry, 5000);
  }
};
connectWithRetry();

// The mongodb connection string is stored in the .env file. The connection string is used to connect to the MongoDB database. The connection string is stored in the MONGO_URI variable. The MONGO_URI variable is used to connect to the MongoDB database. The connection string is stored in the .env file. The connection string is used to connect to the MongoDB database. The connection string is stored in the MONGO_URI variable. The MONGO_URI variable is used to connect to the MongoDB database.

// const userCollection = client.db("test").collection("users");
// const placedProducts = client.db("test").collection("userAndProducts");
// const authentication = client.db("test").collection("authentication");
async function run() {
  try {
    await client.connect();clearImmediate
    await client.db("users").command({ ping: 1 });
    console.log("Database is connected successfully.");
  } finally {
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Task app listening on ${port}`);
});

app.get("/", (req, res) => {
  res.send("Chatboot server is running successfully!");
});

