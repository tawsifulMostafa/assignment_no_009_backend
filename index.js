const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
require("dotenv").config();

const app = express();
const port = process.env.PORT_URI

app.use(cors());
app.use(express.json());

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.FRONTEND_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {


    return res.status(403).json({
      message: "forbidden",
    });
  }
};



const client = new MongoClient(process.env.MONGODB_URI);
async function connectToMongoDB() {
  try {
    // await client.connect();


    const db = client.db("studyNook");
    const RoomsCollection = db.collection("rooms");
    const bookingCollection = db.collection("booked-rooms");

    app.post('/add-room', verifyToken, async (req, res) => {
      const addedRooms = req.body
      const result = await RoomsCollection.insertOne(addedRooms)


      if (result.acknowledged === true) {
        {
          res.status(201).json({
            success: true,
            message: "Room added successfully",
            insertedId: result.insertedId,
          });
        }
      }

    })

    app.get("/rooms", async (req, res) => {
      const rooms = await RoomsCollection.find().toArray();
      res.json(rooms);
    });
    app.get("/rooms/featured", async (req, res) => {
      const featuredRooms = await RoomsCollection.find({}).limit(6).toArray()
      res.json(featuredRooms)

    })

    app.get("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      const result = await RoomsCollection.findOne({ _id: new ObjectId(id) });

      if (!result) {
        return res.status(404).json({
          message: "room not found"
        })

      } else {
        res.json(result)
      }
    });

    app.get("/booking/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params
      const result = await bookingCollection.find({ userId: userId }).toArray()
      res.json(result)
    })
    app.get("/rooms/user/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params
      const result = await RoomsCollection.find({ userId: userId }).toArray()
      res.json(result)
    })
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;

        const {
          roomId,
          bookingDate,
          startTime,
          endTime
        } = bookingData;


        const existingBooking = await bookingCollection.findOne({
          roomId: roomId,
          bookingDate: bookingDate,
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        });


        if (existingBooking) {
          return res.status(409).json({
            message: "This room is already booked for this time."
          });
        }
        bookingData.status = "confirmed";


        const result = await bookingCollection.insertOne(bookingData);

        res.status(201).json({
          message: "Booking successful",
          result
        });

      } catch (error) {
        console.error("Booking Error:", error.message);

        res.status(500).json({
          error: error.message
        });
      }
    });
    app.patch("/rooms/:id", verifyToken, async (req, res) => {
      const newRoomData = req.body;
      const { id } = req.params;

      const result = await RoomsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: newRoomData }
      );

      if (result.acknowledged === true) {
        res.status(200).json({
          success: true,
          message: "Room edited successfully",
          modifiedCount: result.modifiedCount,
        });
      }
    });
    app.patch("/bookings/:bookingId", verifyToken, async (req, res) => {
      const { bookingId } = req.params;

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: "cancelled" } }
      );

      res.send(result);
    });

    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      const { id } = req.params
      const result = await RoomsCollection.deleteOne({ _id: new ObjectId(id) })
      if (result.acknowledged === true) {
        {
          res.status(201).json({
            success: true,
            message: "Room deleted successfully",
            insertedId: result.insertedId,
          });
        }
      }


    })



  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}

connectToMongoDB();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});