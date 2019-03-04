var {User} = require('./../models/user');

var authenticate = async (req, res, next) => {
  // const token = req.header('x-auth');
  const token = req.session.secureToken;
  // delete req.session.secureToken;
  // console.log('token from x-auth', token);
  try {
    const user = await User.findByToken(token);
    // console.log('responsed user: ', user);
    if(!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (e) {

    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
    // res.status(401).send(e);
  }
};

module.exports = {authenticate};
