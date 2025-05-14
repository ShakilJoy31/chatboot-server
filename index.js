import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB with retry logic
const connectWithRetry = async (maxRetries = 5, retryDelay = 5000) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log('Connected to MongoDB');
      return;
    } catch (err) {
      retries++;
      console.error(`Error connecting to MongoDB (attempt ${retries}/${maxRetries}):`, err.message);
      
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('Max retries reached. Could not connect to MongoDB.');
        throw err;
      }
    }
  }
};

// Webhook Handlers
app.post("/webhook", async (req, res) => {
  try {
    let body = req.body;

    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Immediately acknowledge receipt of the webhook
    res.status(200).send("EVENT_RECEIVED");

    if (body.object !== "page") {
      return;
    }

    // Process entries sequentially to avoid rate limiting
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        try {
          if (event.message) {
            await handleMessage(event);
          } else if (event.postback) {
            // Handle postback here if needed
          }
        } catch (error) {
          console.error('Error processing message:', error);
          // Continue with next message even if one fails
        }
      }
    }
  } catch (error) {
    console.error('Error in webhook handler:', error);
  }
});

// Getting response from custom made chatbot
async function getMedibotResponse(userMessage) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://chat-pdf-8h3c.onrender.com/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        query: userMessage,
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    console.log("Raw API response:", responseText);

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return { result: responseText }; // Fallback to raw text if parsing fails
    }
  } catch (error) {
    console.error("Full API error:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }
}

async function handleMessage(event) {
  const senderId = event.sender.id;
  const message = event.message;

  // Add input validation
  if (!message?.text?.trim()) {
    return await sendTextMessage(senderId, "Please send a text message.");
  }

  try {
    console.log("Processing message:", message.text);
    const response = await getMedibotResponse(message.text);

    // Handle empty/error responses
    const replyText = response?.result?.trim() || 
      "I couldn't understand that. Could you rephrase?";

    await sendTextMessage(senderId, replyText);
  } catch (error) {
    console.error("Full processing error:", error);
    await sendTextMessage(senderId,
      "I'm having technical difficulties. Please try again later.");
  }
}

async function sendTextMessage(recipientId, messageText) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text: messageText }
  };

  try {
    await callSendAPI(messageData);
  } catch (error) {
    console.error('Failed to send message:', error);
    // Implement retry logic here if needed
  }
}

async function callSendAPI(messageData) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v12.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log("Successfully sent message with id %s to recipient %s", 
        data.message_id, data.recipient_id);
    } else {
      console.error("Failed to send message:", data.error);
      throw new Error(data.error?.message || 'Unknown Facebook API error');
    }
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

// Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// Health Check
app.get("/", async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
    res.status(200).json({
      status: "healthy",
      database: "connected",
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

// Start Server
const PORT = process.env.PORT || 2000;

(async () => {
  try {
    await connectWithRetry();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();