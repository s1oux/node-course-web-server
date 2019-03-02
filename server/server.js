require('./config/config.js');

const _ = require('lodash');
const express = require('express');
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
    title: 'welcome to main page',
    welcomeMessage: 'Nu darova stalker'
  });
});

app.post('/', urlencodedParser, (request, response) => {
  if(!request.body) {
    return response.status(400).send();
  }

  response.render('home.hbs', {
    title: 'welcome to main page',
    welcomeMessage: 'Nu darova stalker',
    respondedMessage: request.body.message
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

    res.header('x-auth', token).send(user);
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

    const user = new User(body);

    await user.save();
    const token = user.generateAuthToken();
    res.header('x-auth', token).send(user);
  } catch(e) {
    res.status(400).send(e);
  }
});

// end of register page region

app.get('/about', (request, response) => {

  response.render('about.hbs', {
    title: 'about page'
  });
});

app.get('/projects', (request, response) => {
  response.render('projects.hbs', {
    title: 'projects page'
  });
});

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
