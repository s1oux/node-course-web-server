require('./config/config.js');

const _ = require('lodash');
const express = require('express');
var session = require('express-session');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const expressHbs = require('express-handlebars');
const {ObjectID} = require('mongodb');
const axios = require('axios');

var {mongoose} = require('./db/mongoose');
var {User} = require('./models/user');
var {Book} = require('./models/book');
var {authenticate} = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;
const urlencodedParser = bodyParser.urlencoded({extended: false});

app.use(bodyParser.json());
app.use(session({
  secret: 'dont know',
  cookie: {
    maxAge: 360000
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

    if(user.role === 'customer') {
      var redirectTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      console.log('redirection route: ', redirectTo);
      req.session.secureToken = token;
      req.session.isAuthorized = true;
      res.header('x-auth', token).redirect(redirectTo);
    } else if(user.role === 'admin') {
      delete req.session.returnTo;
      req.session.secureToken = token;
      req.session.isAuthorized = true;
      req.session.isAdmin = true;
      res.header('x-auth', token).redirect('/admin');
    } else if(user.role === 'manager') {
      delete req.session.returnTo;
      req.session.secureToken = token;
      req.session.isAuthorized = true;
      req.session.isAdmin = true;
      res.header('x-auth', token).redirect('/manager');
    }

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

// admin page region
// display admin main page
app.get('/admin', authenticate, async (req, res) => {
  const managers = await User.find({ role: 'manager' });

  res.render('admin.hbs', {
    title: 'Admin',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    css: ['admin.css'],
    js: ['admin.js'],
    managers
  });

});

// display manager addition admin page
app.get('/admin/add', authenticate, (req, res) => {

  res.render('admin-add.hbs', {
    title: 'Adding manager',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    css: ['admin-form.css']
  });

});

// handling manager addition admin page
app.post('/admin/add', urlencodedParser, authenticate, async (req, res) => {
  try {
    const body = _.pick(req.body, ['email', 'password', 'username', 'phonenumber']);
    body.city = 'default';
    body.department = '00000';
    body.role = 'manager';
    const user = new User(body);

    await user.save();

    res.status(200).redirect('/admin');
  } catch(e) {
    res.status(400).send(e);
  }
});

// display manager edition admin page --transfer data to form
app.get('/admin/edit/:email', authenticate, async (req, res) => {
  const email = req.params.email;
  const manager = await User.findOne({ email, role: 'manager' });

  req.session.managerToUpdate = email;

  res.render('admin-edit.hbs', {
    title: 'Editing manager',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    manager: manager,
    css: ['admin-form.css']
  });

});

app.post('/admin/edit', urlencodedParser, authenticate, async (req, res) => {
  const email = req.session.managerToUpdate;
  delete req.session.managerToUpdate;
  const body = _.pick(req.body, ['username', 'phonenumber']);

  try {

    const result = await User.updateOne(
      { "email" : email },
      { $set : {
        "username" : body.username,
        "phonenumber" : body.phonenumber } }
    );

    console.log(result);

    res.redirect('/admin');
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
  }
});


// handling manager deletion --- add deletion !!!!
app.get('/admin/remove/:email', authenticate, async (req, res) => {
  const email = req.params.email;

  const manager = await User.remove({ email });
  console.log(manager);

  res.redirect('/admin');
});
// end of admin page region

// region of protected page
app.get('/about', authenticate, (request, response) => {

  response.render('about.hbs', {
    title: 'about page',
    welcomeMessage: 'you are authorized',
    isAuthorized: request.session.isAuthorized || false
  });
});
// end of protected page region

// test route for displaying book by url
app.get('/projects', (request, response) => {

  response.render('projects.hbs', {
    title: 'projects page',
    bookUrl: __dirname + '/../public/MeinKampf.html',
    // bookUrl: 'https://docdro.id/QxOjFQ2',
    isAuthorized: request.session.isAuthorized || false,
    css: ['profile.css']
  });
});

// end of test route for displaying books

// test route for book response

app.get('/books', async (request, response) => {
  // right method for displaying books
  //
  const books = await Book.find();

  response.render('books.hbs', {
    title: 'books page',
    isAuthorized: request.session.isAuthorized || false,
    books: books,
    css: ['profile.css']
  });

  // initial method view for initializing books database
  // var query = '*';
  // var bookapiUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&format=json`;
  //
  // axios.get(bookapiUrl).then((res) => {
  //   var respondedBooks = [];
  //
  //   if(res.error) {
  //     throw new Error('unable to get book response');
  //   }
  //
  //   var books = res.data.items.filter((book) => book.accessInfo.pdf.isAvailable === true);
  //
  //   console.log(books);
  //
  //   books.forEach((book) => {
  //     respondedBooks.push({
  //       id: book.id,
  //       title: book.volumeInfo.title,
  //       author: book.volumeInfo.authors[0],
  //       description: book.volumeInfo.description,
  //       image: book.volumeInfo.imageLinks.smallThumbnail,
  //       amount: book.saleInfo.listPrice.amount,
  //       readUrl: `https://books.google.com.ua/books?id=${book.id}&lpg=PP1&pg=PP1&output=embed`
  //     });
  //   });
  //
  //   console.log(respondedBooks);
  //
  //   respondedBooks.forEach((bookItem) => {
  //     const book = new Book(bookItem);
  //
  //     book.save().then((result) => {
  //       console.log(result);
  //     }).catch((e) => {
  //       console.log(e);
  //       });
  //     });
  //
  //   response.render('books.hbs', {
  //     title: 'books page',
  //     isAuthorized: request.session.isAuthorized || false,
  //     books: respondedBooks,
  //     css: ['profile.css']
  //   });
  //
  // }).catch((error) => {
  //   if(error.code === 'ENOTFOUND') {
  //     console.log('unable to connect to server');
  //   } else {
  //     console.log(error.message);
  //   }
  // });

});

// end of test route for book response

// logout route region
app.get('/logout', authenticate, async (req, res) => {
  try {
    await req.user.removeToken(req.token);
    delete req.session.isAuthorized;
    delete req.session.isAdmin;
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
  // console.log('body in /profile/edit:: ', body);
  try {
    const user = await User.findByToken(token);
    console.log(user);

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
