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

    //add rooms

    app.post('/add-room', verifyToken, async (req, res) => {
      const addedRooms = {
        ...req.body,
        userId : req.user.id,
        createdAt: new Date()
      }
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
//room collection finding 

    app.get("/rooms", async (req, res) => {
      const { amenities, name } = req.query
      const query = {};
      if (amenities) {
        query.amenities = {
          $all: Array.isArray(amenities) ? amenities : [amenities],
        };
      }
      if (name) {
        query.name = {
          $regex: name,
          $options: "i",
        };
      }
      const rooms = await RoomsCollection.find(query).toArray();
      res.json(rooms);
    });

    //featured card in home.............
    app.get("/rooms/featured", async (req, res) => {
      const featuredRooms = await RoomsCollection.find({}).sort({createdAt : -1}).limit(6).toArray()
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
      const { userId } = req.params;

      if (userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to access these bookings",
        });
      }

      const result = await bookingCollection
        .find({ userId: userId })
        .toArray();

      res.json(result);
    });
    app.get("/rooms/user/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params;

      if (userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to access these rooms",
        });
      }

      const result = await RoomsCollection
        .find({ userId: userId })
        .toArray();

      res.json(result);
    });


//Booking Card posting

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
        bookingData.bookingCount = 0;

  const result = await bookingCollection.insertOne(bookingData);

        await RoomsCollection.updateOne(
          {
            _id: new ObjectId(roomId)
          }, {
          $inc: {
            bookingCount: 1
          }
        }
        );

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
    //  edit Room
    app.patch("/rooms/:id", verifyToken, async (req, res) => {
      const newRoomData = req.body;
      const { id } = req.params;

      const room = await RoomsCollection.findOne({
        _id: new ObjectId(id)
      })

      if (!room) {
        return res.status(404).json({
          message: "Room Not Found"
        })
      }
      if (room.userId !== req.user.id) {
        return res.status(403).json({
          message: "UnAuthorized"
        })

      }

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


 //Cancel Booking
    app.patch("/bookings/:bookingId", verifyToken, async (req, res) => {
      const { bookingId } = req.params;
      const booking = await bookingCollection.findOne({
        _id: new ObjectId(bookingId)

      })
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      if (booking.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You cannot cancel this booking",
        });
      }

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: "cancelled" } },);

      res.send(result);
    });


    //  Delete rooms

    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      const { id } = req.params

      const room = await RoomsCollection.findOne({
        _id: new ObjectId(id)
      })
      if (!room) {
       return res.status(404).json({
          message: "Room Not Found"
        })
      }
      if (room.userId !== req.user.id) {
      return res.status(403).json({
          message: "Only Room Owner can delete Room"
        })
      }

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