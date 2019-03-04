require('./config/config.js');

const _ = require('lodash');
const express = require('express');
var session = require('express-session');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const expressHbs = require('express-handlebars');
const {ObjectID} = require('mongodb');

var {mongoose} = require('./db/mongoose');
var {User} = require('./models/user');
var {authenticate} = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;
const urlencodedParser = bodyParser.urlencoded({extended: false});

app.use(bodyParser.json());
app.use(session({
  secret: 'dont know',
  cookie: {
    maxAge: 60000
  }
}));

app.engine("hbs", expressHbs(
    {
        layoutsDir: __dirname + "/../views/layouts",
        defaultLayout: "layout",
        extname: "hbs"
    }
))

app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/../public'));
hbs.registerPartials(__dirname + '/../views/partials');
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js')); // redirect JS Bootstrap
app.use('/js', express.static(__dirname + '/../node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css')); // redirect CSS bootstrap

// main page
app.get('/', (request, response) => {
  response.render('home.hbs', {
    title: 'Home',
    welcomeMessage: 'Nu darova stalker',
    isAuthorized: request.session.isAuthorized || false
  });
});

app.post('/', urlencodedParser, (request, response) => {
  if(!request.body) {
    return response.status(400).send();
  }

  response.render('home.hbs', {
    title: 'Home',
    welcomeMessage: 'Nu darova stalker',
    respondedMessage: request.body.message,
    isAuthorized: request.session.isAuthorized || false
  });
});

// end of main page region

// login page region
app.get('/signIn', (request, response) => {
  response.render('sign-in.hbs', {
    title: 'Login',
    isLogin: true,
    css: ['signin.css']
  });
});

app.post('/signIn',urlencodedParser, async (req, res) => {
  try {
    const body = _.pick(req.body, ['email', 'password']);
    const user = await User.findByCredentials(body.email, body.password);
    const token = await user.generateAuthToken();

    var redirectTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    console.log('redirection route: ', redirectTo);
    req.session.secureToken = token;
    req.session.isAuthorized = true;
    res.header('x-auth', token).redirect(redirectTo);
    // res.header('x-auth', token).send(user);
  } catch (e) {
    res.status(400).send(e);
  }
});


// end of login page region


// register page region
app.get('/signUp', (request, response) => {

  response.render('sign-up.hbs', {
    title: 'Login',
    isLogin: true,
    css: ['signup.css']
  });
});

app.post('/signUp', urlencodedParser, async (req, res) => {
  try {
    const body = _.pick(req.body, ['email', 'password', 'username', 'phonenumber', 'city', 'department']);
    body.role = 'customer';
    var redirectTo = req.session.returnTo || '/';
    const user = new User(body);

    await user.save();
    const token = user.generateAuthToken().then((result) => {
      // console.log('result in then sign up', result);
      req.session.secureToken = result;
      req.session.isAuthorized = true;
      res.header('x-auth', result).redirect(redirectTo);
    });
    // console.log('token in req',req.session.secureToken);
    // console.log('token in token', token);
    // res.header('x-auth', token).send(user);
  } catch(e) {
    res.status(400).send(e);
  }
});

// end of register page region

// region of protected page
app.get('/about', authenticate, (request, response) => {

  response.render('about.hbs', {
    title: 'about page',
    welcomeMessage: 'you are authorized',
    isAuthorized: request.session.isAuthorized || false
  });
});

app.get('/projects', (request, response) => {
  response.render('projects.hbs', {
    title: 'projects page',
    isAuthorized: req.session.isAuthorized || false
  });
});
// end of protected page region

// logout route region
app.get('/logout', authenticate, async (req, res) => {
  try {
    await req.user.removeToken(req.token);
    delete req.session.isAuthorized;
    delete req.session.secureToken;

    res.status(200).redirect('/');
    // res.status(200).send();
  } catch(e) {
    res.status(400).send();
  }
});
// end of region

// profile route region
app.get('/profile', authenticate, async (req, res) => {
  const token = req.session.secureToken;

  // console.log('TOKEN IN PROFILE', token);
  try {
    const user = await User.findByToken(token);
    console.log(user);

    res.render('profile.hbs', {
      title: 'Profile',
      user: user,
      css: ['profile.css'],
      isAuthorized: req.session.isAuthorized || false
    });
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
    // res.status(401).send(e);
  }
});

app.get('/profile/edit', authenticate, async (req, res) => {
  const token = req.session.secureToken;

  // console.log('TOKEN IN PROFILE', token);
  try {
    const user = await User.findByToken(token);
    console.log(user);

    res.render('profile-edit.hbs', {
      title: 'Edit Profile',
      user: user,
      css: ['profile-edit.css'],
      isAuthorized: req.session.isAuthorized || false
    });
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
    // res.status(401).send(e);
  }
});

app.post('/profile/edit', urlencodedParser, authenticate, async (req, res) => {
  const token = req.session.secureToken;
  const body = _.pick(req.body, ['username', 'phonenumber', 'city', 'department']);
  console.log('body in /profile/edit:: ', body);
  // console.log('TOKEN IN PROFILE', token);
  try {
    const user = await User.findByToken(token);
    console.log(user);
    // user.username = body.username;
    // user.phonenumber = body.phonenumber;
    // user.city = body.city;
    // user.department = body.department;

    const result = await User.updateOne(
      { "email" : user.email },
      { $set : {
        "username" : body.username,
        "phonenumber" : body.phonenumber,
        "city" : body.city,
        "department" : body.department } }
    );

    console.log(result);

    res.redirect('/profile');
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
    // res.status(401).send(e);
  }
});
// end of profile route region

app.get('/bad', (request, response) => {
  response.send({
    errorMessage: 'something bad has occurred'
  });
});

//routes for user

app.post('/users', async (req, res) => {
  try {
    const body = _.pick(req.body, ['email', 'password']);
    const user = new User(body);

    await user.save();
    const token = user.generateAuthToken();
    res.header('x-auth', token).send(user);
  } catch(e) {
    res.status(400).send(e);
  }
});

app.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

app.post('/users/login', async (req, res) => {
  try {
    const body = _.pick(req.body, ['email', 'password']);
    const user = await User.findByCredentials(body.email, body.password);
    const token = await user.generateAuthToken();

    res.header('x-auth', token).send(user);
  } catch (e) {
    res.status(400).send();
  }
});

app.delete('/users/me/token', authenticate, async (req, res) => {
  try {
    await req.user.removeToken(req.token);
    res.status(200).send();
  } catch(e) {
    res.status(400).send();
  }
});

app.listen(port, () => {
  console.log(`started on port ${port}`);
});


module.exports = {app};
