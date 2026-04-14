const express = require("express");
const { scanSingleMarket } = require("../controllers/scanController");

const router = express.Router();

router.get("/", scanSingleMarket);

module.exports = router;
