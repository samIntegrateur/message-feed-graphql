const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();
    throw error;
  }

  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      password: hashedPassword,
      name,
    });

    const newUserResult = await user.save();

    res.status(201).json({message: 'User created', userId: newUserResult._id});

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};


exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({email: email});

    if (!user) {
      const error = new Error('The user could not be found.');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordEqual = bcrypt.compare(password, user.password);

    if (!isPasswordEqual) {
      const error = new Error('Wrong password.');
      error.statusCode = 401;
      throw error;
    }

    const token = jwt.sign({
        email: user.email,
        userId: user._id.toString(),
      }, 'myawesomesecretkey',
      { expiresIn: '1h'}
    );

    res.status(200).json({ token, userId: user._id.toString() });

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
}
