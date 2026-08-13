const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const dotenv = require("dotenv").config()
const port = process.env.PORT_URI;

const client =new MongoClient(process.env.MONGODB_URI)

 
async function connectToMongoDB() {
     try {
    await client.connect();
    
    const db = client.db("studyNook")
    const StudyNookCollection = db.collection("StudyNookCollections")         

    
    
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