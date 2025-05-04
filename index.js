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
const port = 2000;
const nodeEnv = process.env.MONGO_URI;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const uri = nodeEnv;
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


// The webhook configurations...........................................................

// Posting message.
app.post("/webhook", (req, res) => {
  let body = req.body;

  console.log(`\u{1F7EA} Received webhook:`);
  console.dir(body, { depth: null });
    
  if (body.object === "page") {
    // Iterate through each entry (there may be multiple if batched)
    body.entry.forEach(function(entry) {
      // Iterate through each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          // Handle message event
          console.log("Received message:", event.message);
          handleMessage(event);
        } else if (event.postback) {
          // Handle postback event
          console.log("Received postback:", event.postback);
        }
      });
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

function handleMessage(event) {
  const senderId = event.sender.id;
  const message = event.message;
  
  console.log(`Received message from ${senderId}:`, message.text);
  // Here you would typically process the message and send a reply
}


// Getting messages.
// Add support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  // Parse the query params
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
  
    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === "subscribe" && token === process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
        // Respond with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        // Respond with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
      }
    }
  });



app.listen(port, () => {
  console.log(`Task app listening on ${port}`);
});

app.get("/", (req, res) => {
  res.send("Chatboot server is running successfully!");
});

