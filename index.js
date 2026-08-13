const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
require("dotenv").config()
const cors = require("cors")
const port = process.env.PORT_URI;

app.use(cors())
app.use(express())

const client =new MongoClient(process.env.MONGODB_URI)

 
async function connectToMongoDB() {
     try {
    await client.connect();
    
    const db = client.db("studyNook")
    const StudyNookCollection = db.collection("added-Rooms")
    const RoomsCollection =  db.collection("rooms")        

    app.post("/add-rooms" , async(req , res) =>{
      const rooms =await req.body
      const results = await StudyNookCollection.insertOne(rooms)
    
    res.json(results)
    })

    app.get("/rooms" , async(req , res) =>{
        const rooms = await RoomsCollection.find().toArray()
        res.json(rooms)
    })
     app.get('/rooms/:id' , async(req , res) => {
            const {id} = await req.params
            const result = await RoomsCollection.findOne({_id: new ObjectId(id)})
            res.json(result)
     })
    
    
    return client;
  } catch (err) {
    console.dir(err);
  }
}
connectToMongoDB()

 
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Example app listening on port ${port}`);
}); 