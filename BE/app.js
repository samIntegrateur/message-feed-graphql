const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');

const dbConfig = require('./db-config');

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = path.parse(file.originalname).name;
    const fileExt = path.parse(file.originalname).ext;
    cb(null, fileName + '-' + uniqueSuffix + fileExt);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
// parse incoming json data
app.use(bodyParser.json()); // application/json

app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);

// make the images folder available
app.use('/images', express.static(path.join(__dirname, 'images')));

// Allow cross origin
// https://www.udemy.com/course/nodejs-the-complete-guide/learn/lecture/12087628#overview
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

app.use((error, req, res, next) => {
  console.log('error', error);
  // statusCode and errorList are custom properties we may have added
  const status = error.statusCode || 500;
  const message = error.message;
  const errorList = error.errorList || null;
  res.status(status).json({
    message,
    errorList,
  })
});

mongoose.connect(dbConfig, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(result => {
    const server = app.listen(8080);
    const io = require('./socket').init(server);
    io.on('connection', socket => {
      console.log('Client connected');
    });
  })
  .catch(err => console.error(err));

