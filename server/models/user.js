const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    minlength: 8,
    trim: true,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    minlength: 5,
    trim: true,
    unique: true
  },
  phonenumber: {
    type: String,
    required: true,
    minlength: 10,
    trim: true,
    validate: {
      validator: validator.isMobilePhone,
      message: '{VALUE} is not a phone number'
    }
  },
  city: {
    type: String,
    required: true,
    minlength: 3,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: validator.isNumeric,
      message: '{VALUE} is not a numeric'
    }
  },
  role: {
    type: String
  },
  tokens: [{
    access: {
      type: String,
      required:true
    },
    token: {
      type: String,
      required:true
    }
  }],
  offers: [{
      offerId: {
        type: mongoose.Schema.Types.ObjectId
      }
  }],
  downloadedBooks: [{
    bookId: {
      type: String
    }
  }]
});

UserSchema.methods.toJSON = function () {
  var user = this;
  var userObject = user.toObject();

  return _.pick(userObject, ['_id', 'email', 'username', 'phonenumber', 'city', 'department', 'role']);
};

UserSchema.methods.generateAuthToken = function () {
  var user = this;
  var access = 'auth';
  var token = jwt.sign({_id: user._id.toHexString(), access},
    process.env.JWT_SECRET).toString();
  user.tokens = user.tokens.concat([{access, token}]);

  return user.save().then(() => {
    return token;
  });
};

UserSchema.methods.removeToken = function(token) {
  var user = this;

  return user.updateOne({
    $pull: {
      tokens: {token}
    }
  });
};

UserSchema.statics.findByToken = function (token) {
  var User = this;

  var decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.log('got into rejection on jwtverify');
    return Promise.reject();
  }

  console.log('successfully decoded');

  return User.findOne({
    '_id': decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

UserSchema.statics.findByCredentials = function(email, password) {
  var User = this;

  return User.findOne({email}).then((user) => {
    if(!user) {
      return Promise.reject();
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if(res) {
          resolve(user);
        } else {
          reject();
        }
      });
    });
  });
};

UserSchema.pre('save', function (next) {
  var user = this;

  if(user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

var User = mongoose.model('User', UserSchema);

module.exports = {
  User
};
