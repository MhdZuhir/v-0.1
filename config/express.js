// config/express.js
const express = require('express');
const path = require('path');

/**
 * Configure Express application
 * @param {Express} app - Express application instance
 */
exports.setup = (app) => {
  // Middleware setup
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));
};