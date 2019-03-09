const mongoose = require('mongoose');
const _ = require('lodash');

var CommentSchema = new mongoose.Schema({
  bookId: {
    type: String,
    required: true
  },
  messageBody: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  }
});

CommentSchema.methods.toJSON = function () {
  var comment = this;
  var commentObject = comment.toObject();

  return _.pick(commentObject, ['bookId', 'messageBody', 'username']);
};


var Comment = mongoose.model('Comment', CommentSchema);

module.exports = {
  Comment
};
