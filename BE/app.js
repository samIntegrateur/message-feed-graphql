const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const graphqlHttp = require('express-graphql');

const dbConfig = require('./db-config');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

const { clearImage } = require('./util/file');

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

  // Avoid a confusing 405 error
  // https://www.udemy.com/course/nodejs-the-complete-guide/learn/lecture/12197928#overview
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

// use a classic rest endpoint to handle image upload (with multer)
app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not authenticated');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided!' });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  const filePath = req.file.path.replace(/\\/g, '/'); // for windows
  return res.status(201).json({message: 'File stored', filePath: filePath});
});

app.use('/graphql', graphqlHttp({
  schema: graphqlSchema,
  rootValue: graphqlResolver,
  graphiql: true,
  customFormatErrorFn(err) {
    // originalError is error we manually thrown
    if (!err.originalError) {
      return err;
    }
    const errorList = err.originalError.errorList;
    const message = err.message || 'An error occurred.';
    const status = err.originalError.code || 500;
    return {
      message,
      status,
      errorList,
    }
  }
}));

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
    app.listen(8080);
  })
  .catch(err => console.error(err));
