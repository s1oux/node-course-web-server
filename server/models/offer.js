const mongoose = require('mongoose');
const _ = require('lodash');

var OfferSchema = new mongoose.Schema({
  bookId: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerDept: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerCity: {
    type: String,
    required: true
  },
  inProgress: {
    type: Boolean,
    default: false
  },
  completed: {
    type: Boolean,
    default: false
  }
});

OfferSchema.methods.toJSON = function () {
  var offer = this;
  var offerObject = offer.toObject();

  return _.pick(offerObject, ['bookId', 'customerEmail', 'customerName', 'customerDept', 'customerCity', 'customerPhone',  'inProgress', 'completed']);
};


var Offer = mongoose.model('Offer', OfferSchema);

module.exports = {
  Offer
};
