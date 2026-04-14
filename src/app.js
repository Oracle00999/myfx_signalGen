const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const scanRoutes = require("./routes/scanRoutes");
const signalRoutes = require("./routes/signalRoutes");

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// health route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Forex market analyzer API is running",
  });
});

// api routes
app.use("/api/scan", scanRoutes);
app.use("/api/signals", signalRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

module.exports = app;
