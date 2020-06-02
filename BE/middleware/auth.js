const jwt = require('jsonwebtoken');

// https://www.udemy.com/course/nodejs-the-complete-guide/learn/lecture/12097922#overview
module.exports = (req, res, next) => {
  const token = req.get('Authorization') && req.get('Authorization').split(' ')[1]; // remove 'bearer '

  if (!token) {
   req.isAuth = false;
   return next();
  }

  let decodedToken;

  try {
    decodedToken = jwt.verify(token, 'myawesomesecretkey');
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};
