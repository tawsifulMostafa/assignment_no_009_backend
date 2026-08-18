const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT_URI

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
async function connectToMongoDB() {
  try {
    await client.connect();


    const db = client.db("studyNook");
    const RoomsCollection = db.collection("rooms");
    const bookingCollection = db.collection("booked-rooms");

    app.post('/add-room', async (req, res) => {
      const addedRooms = req.body
      const result = await RoomsCollection.insertOne(addedRooms)
      res.json(result)

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
   app.get("/rooms/featured" , async(req , res) => {
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

      }
      res.json(result);
    });

    app.get("/booking/:userId", async (req, res) => {
      const { userId } = req.params
      const result = await bookingCollection.find({ userId: userId }).toArray()
      res.json(result)
    })
    app.get("/rooms/user/:userId", async (req, res) => {
      const { userId } = req.params
      const result = await RoomsCollection.find({ userId: userId }).toArray()
      res.json(result)
    })
    app.post("/bookings", async (req, res) => {
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
    app.patch("/rooms/:id", async (req, res) => {
      const newRoomData = req.body
      const { id } = req.params
      const result = await RoomsCollection.updateOne({ _id: new ObjectId(id) }, { $set: newRoomData })
      res.json(result)
      if (res.acknowledged === true) {
        message: "Room edited successfully"
      }
    })
    app.patch("/bookings/:bookingId", async (req, res) => {
      const { bookingId } = req.params;

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: "cancelled" } }
      );

      res.send(result);
    });

    app.delete("/rooms/:id", async (req, res) => {
      const { id } = req.params
      const result = await RoomsCollection.deleteOne({ _id: new ObjectId(id) })
      res.json(result)
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