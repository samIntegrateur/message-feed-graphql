const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const io = require('../socket');

const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();

    const posts = await Post.find()
      .populate('creator', 'name _id')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Posts fetched.',
      posts,
      totalItems,
    });

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  // validate
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();

    // throwing error will exit current function and reach next error handling or middlware
    // next if we are in an async block
    throw error;
  }

  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }

  const { title, content } = req.body;
  const imageUrl = req.file.path.replace(/\\/g, '/'); // for windows

  // create post in db
  const post = new Post({
    title,
    content,
    imageUrl,
    creator: req.userId,
  });

  try {
    const newPostResult = await post.save();
    const newPostDoc =  newPostResult._doc;

    // add post to the user's posts
    const user = await User.findById(req.userId);
    user.posts.push(post);

    await user.save();

    // https://www.udemy.com/course/nodejs-the-complete-guide/learn/lecture/12167300#overview
    // We define an event / chanel
    io.getIO().emit('posts', { action: 'create', post: {
        ...newPostDoc,
        creator: {
          _id: user._id,
          name: user.name,
        }
      }});

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        ...newPostDoc,
        // populate by hand (didn't check the FE, still errors when adding the new to list)
        creator: {
          _id: user._id,
          name: user.name,
        }
      },
    });

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId)
      .populate('creator', 'name _id');

    if (!post) {
      const error = new Error('Could not find the requested post.');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: 'Post fetched.',
      post: post,
    })

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;

  // validate
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();
    throw error;
  }

  const { title, content } = req.body;
  let imageUrl = req.body.image;

  // if new file, replace
  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/'); // for windows
  }

  if (!imageUrl) {
    const error = new Error('No file picked.');
    error.statusCode = 422;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator');

    if (!post) {
      const error = new Error('Could not find the requested post.');
      error.statusCode = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized to edit this post.');
      error.statusCode = 403;
      throw error;
    }

    // if new image, delete old
    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const postSaveResult = await post.save();

    io.getIO().emit('posts', { action: 'update', post: postSaveResult});

    res.status(200).json({
      message: 'Post updated',
      post: postSaveResult,
    });

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Could not find the requested post.');
      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      console.log('post.creator', post.creator);
      console.log('req.userId', req.userId);
      const error = new Error('Not authorized to delete this post.');
      error.statusCode = 403;
      throw error;
    }

    // check logged in user
    clearImage(post.imageUrl);

    await Post.findByIdAndRemove(postId);

    const user = await User.findById(req.userId);

    // remove post from user posts too
    user.posts.pull(postId);

    await user.save();

    io.getIO().emit('posts', { action: 'delete', post: postId});

    res.status(200).json({
      message: 'Deleted post'
    })

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId);
    res.status(200).json({
      status: user.status,
    })

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  console.log('req.body', req.body)
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();
    throw error;
  }

  const userId = req.userId;
  const newStatus = req.body.newStatus;

  try {
    const user = await User.findById(userId);
    user.status = newStatus;
    await user.save();

    res.status(201).json({
      status: newStatus,
    });

  } catch (err) {
    if (!err.status) {
      err.statusCode = 500;
    }
    next(err);
  }
};

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.error(err));
};
