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
const connectWithRetry = async () => {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// Webhook Handlers
app.post("/webhook", async (req, res) => {
  let body = req.body;

  console.dir(body, { depth: null });
    
  if (body.object === "page") {
    // Process entries in parallel
    const processing = body.entry.map(async (entry) => {
      await Promise.all(entry.messaging.map(async (event) => {
        if (event.message) {
          await handleMessage(event);
        } else if (event.postback) {
          // Handle postback here if needed
        }
      }));
    });

    await Promise.all(processing);
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});


// Getting response from custom made chatbot.........................

async function getMedibotResponse(userMessage) {
  try {
    const response = await fetch("https://chat-pdf-8h3c.onrender.com/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        query: userMessage,
        // Add any additional required parameters here
        // For example, if you need to specify a PDF context:
        // pdf_id: "your-pdf-id" 
      }),
      timeout: 10000 // 10 second timeout
    });

    const responseText = await response.text();
    console.log("Raw API response:", responseText); // Debug log

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${responseText}`);
    }

    return JSON.parse(responseText);
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

// async function getAIResponse(userMessage) {
//   try {
//     const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
//         "HTTP-Referer": "http://localhost:3000",
//         "X-Title": "Chatbot",
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({
//         "model": "deepseek/deepseek-r1:free",
//         "messages": [
//           {
//             "role": "user",
//             "content": userMessage
//           }
//         ]
//       })
//     });

//     if (!response.ok) {
//       throw new Error(`AI API request failed with status ${response.status}`);
//     }

//     const data = await response.json();
//     console.log("AI Response:", data);
    
//     // Extract the AI's response content
//     return data.choices[0]?.message?.content || "I didn't get a response from the AI.";
//   } catch (error) {
//     console.error("Error getting AI response:", error);
//     throw error;
//   }
// }

async function sendTextMessage(recipientId, messageText) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text: messageText }
  };

  await callSendAPI(messageData);
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
      throw new Error(data.error.message);
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
    if (mode === "subscribe" && token === process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// Health Check
app.get("/", (req, res) => {
  res.send("Chatbot server is running successfully!");
});

// Start Server
const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});