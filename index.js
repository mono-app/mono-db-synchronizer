require('module-alias/register');
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("@keys/serviceAccountKey.json");
const { Pool } = require("pg");

const PullListener = require("@app/pull");
const PushListener = require("@app/push");

const app = new express();
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  req.connectionPool = new Pool({ idleTimeoutMillis: 1 });
  next();
})

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-fdf76.firebaseio.com",
});

/**
 * PULL - client ask for data from server
 * PUSH - server send data to client
 */

app.get("/sync", PullListener.listen);
app.post("/sync", PushListener.listen);

app.listen(process.env.PORT, () => console.log(`Express is listening to port: ${process.env.PORT}`));
module.exports = { app };