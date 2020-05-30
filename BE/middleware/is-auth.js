const jwt = require('jsonwebtoken');

// https://www.udemy.com/course/nodejs-the-complete-guide/learn/lecture/12097922#overview
module.exports = (req, res, next) => {
  const token = req.get('Authorization') && req.get('Authorization').split(' ')[1]; // remove 'bearer '

  if (!token) {
    const error = new Error('No token provided!');
    error.statusCode = 401;
    throw error;
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, 'myawesomesecretkey');
  } catch (err) {
    err.statusCode = 500;
    throw err;
  }
  if (!decodedToken) {
    const error = new Error('Not authenticated!');
    error.statusCode = 401;
    throw error;
  }
  req.userId = decodedToken.userId;
  next();
};
