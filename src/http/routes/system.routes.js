'use strict';

const express = require('express');
const axios = require('axios');
const { createSystemController } = require('../controllers/system.controller');

function createSystemRouter({ httpClient = axios, now } = {}) {
  const router = express.Router();
  const controller = createSystemController({ axios: httpClient, now });

  router.get('/api/donators', controller.getDonators);
  router.get('/api/server-time', controller.getServerTime);

  return router;
}

module.exports = {
  createSystemRouter
};
