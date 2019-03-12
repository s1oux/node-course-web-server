var {User} = require('./../models/user');

var authenticate = async (req, res, next) => {

  const token = req.session.secureToken;

  try {
    const user = await User.findByToken(token);

    if(!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (e) {

    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
  }
};

module.exports = {authenticate};
