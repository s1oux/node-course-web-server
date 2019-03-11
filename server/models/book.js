const mongoose = require('mongoose');
const _ = require('lodash');

var BookSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  downloadLink: {
    type: String,
    required: true
  },
  readUrl: {
    type: String,
    required: true
  }
});

BookSchema.methods.toJSON = function () {
  var book = this;
  var bookObject = book.toObject();

  return _.pick(bookObject, ['id', 'title', 'author', 'description', 'image', 'amount', 'downloadLink', 'readUrl']);
};

BookSchema.statics.findById = function (id) {
  var Book = this;


  return Book.findOne({
    'id': id
  });
};


var Book = mongoose.model('Book', BookSchema);

module.exports = {
  Book
};
