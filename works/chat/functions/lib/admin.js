"use strict";

let _admin = null;
let _db = null;
let _auth = null;

function init() {
  if (!_admin) {
    _admin = require("firebase-admin");
    _admin.initializeApp();
  }
  return _admin;
}

function getDb() {
  if (!_db) _db = init().firestore();
  return _db;
}

function getAuth() {
  if (!_auth) _auth = init().auth();
  return _auth;
}

function getAdmin() {
  init();
  return _admin;
}

module.exports = { init, getDb, getAuth, getAdmin };
