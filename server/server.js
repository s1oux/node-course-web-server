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
var {Offer} = require('./models/offer');
var {Comment} = require('./models/comment');
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
app.use('/js', express.static(__dirname + '/../node_modules/clipboard/dist'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap-validate/dist'));
app.use('/js', express.static(__dirname + '/../node_modules/bootstrap/dist/js')); // redirect JS Bootstrap
app.use('/js', express.static(__dirname + '/../node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/../node_modules/bootstrap/dist/css')); // redirect CSS bootstrap

// main page
app.get('/', async (request, response) => {
  const books = await Book.find();

  response.render('home.hbs', {
    title: 'Home',
    isAuthorized: request.session.isAuthorized || false,
    books: books,
    css: ['profile.css']
  });

});

// end of main page region

// book manipulation page region

//view
app.get('/books/view/:id', async (req, res) => {
  const id = req.params.id;
  const book = await Book.findOne({ id });

  res.render('book-view.hbs', {
    title: 'Book',
    isAuthorized: req.session.isAuthorized,
    book: book,
    css: ['book-view.css']
  });
});

// read route
app.get('/books/read/:id', async (req, res) => {
  const id = req.params.id;
  const book = await Book.findOne({ id });

  res.render('book-read.hbs', {
    title: 'Reading',
    isAuthorized: req.session.isAuthorized,
    book: book,
    css: ['profile.css']
  });
});

// buy route
app.get('/books/buy/:id', authenticate, async (request, response) => {
  const id = request.params.id;
  const token = request.session.secureToken;

  try {
    const user = await User.findByToken(token);
    const book = await Book.findOne({ id });
    const manager = await User.findOne({ role: 'manager' });

    const body = {
      bookId: book.id,
      customerEmail: user.email,
      customerName: user.username,
      customerDept: user.department,
      customerCity: user.city,
      customerPhone: user.phonenumber
    };

    const offer = new Offer(body);

    await offer.save();

    manager.offers = manager.offers.concat([{offerId: offer._id}]);

    const result = await User.updateOne(
      { "_id" : manager._id },
      { $set : {
        "offers" : manager.offers } }
    );

    response.render('confirmation.hbs', {
      title: 'Response',
      message: 'Your request was registered',
      isAuthorized: request.session.isAuthorized || false,
      css: ['profile.css']
    });
  } catch (e) {
    request.session.returnTo = request.originalUrl;
    resuest.redirect('/signIn');
  }
});

// adding to library route
app.get('/books/add/:id', authenticate, async (request, response) => {
  const id = request.params.id;
  const token = request.session.secureToken;

  try {
    const user = await User.findByToken(token);

    user.downloadedBooks = user.downloadedBooks.concat([{bookId: id}]);

    const result = await User.updateOne(
      { "_id" : user._id },
      { $set : {
          "downloadedBooks" : user.downloadedBooks
        }
      });

    response.redirect('/');
  } catch (e) {
    request.session.returnTo = request.originalUrl;
    response.redirect('/signIn');
  }
});

// routing to link for download page
app.get('/books/download/:id', authenticate, async (request, response) => {
  const id = request.params.id;

  const book = await Book.findOne({ id });

  response.render('book-link.hbs', {
    title: 'Link',
    isAuthorized: request.session.isAuthorized,
    book: book,
    css: ['profile.css'],
    js: ['admin.js']
  });
});

// route displaying comments page
app.get('/books/comments/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  const book = await Book.findOne({ id });
  const comments = await Comment.find({ bookId: id });

  res.render('comments.hbs', {
    title: 'Comments',
    isAuthorized: req.session.isAuthorized,
    book: book,
    comments: comments,
    css: ['profile.css']
  });
});

// route for sending comment
app.post('/books/comments/make/:id',urlencodedParser, authenticate, async (req, res) => {
  const id = req.params.id;
  const body = _.pick(req.body, ['messageText']);
  const token = req.session.secureToken;

  const user = await User.findByToken(token);

  const comment = new Comment({
    bookId: id,
    messageBody: body.messageText,
    username: user.username
  });
  // console.log(comment);
  await comment.save();

  res.redirect(`/books/comments/${id}`);
});

// route viewing books downloaded by user
app.get('/downloaded', authenticate, async (request, response) => {
  const token = request.session.secureToken;

  try {
    const user = await User.findByToken(token);
    const downloadedBooksIds = user.downloadedBooks;
    const books = [];

    await asyncForEach(downloadedBooksIds, async(item) => {
      let book = await Book.findOne({id: item.bookId});
      books.push(book);
    });

    response.render('downloaded-books.hbs', {
      title: 'Downloaded',
      isAuthorized: request.session.isAuthorized || false,
      books: books,
      css: ['profile.css']
    });
  } catch (e) {
    req.session.returnTo = request.originalUrl;
    res.redirect('/signIn');
  }
});

// end of book manipulation page region

// login page region
app.get('/signIn', (request, response) => {
  response.render('sign-in.hbs', {
    title: 'Login',
    isLogin: true,
    css: ['signin.css'],
    js: ['layout.js']
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
  } catch (e) {
    res.render('sign-in.hbs', {
      title: 'Login',
      isLogin: true,
      errorMessage: 'Please, enter valid email and password.',
      css: ['signin.css'],
      js: ['layout.js']
    });
  }
});
// end of login page region


// register page region
app.get('/signUp', (request, response) => {

  response.render('sign-up.hbs', {
    title: 'Login',
    isLogin: true,
    css: ['signup.css'],
    js: ['layout.js']
  });
});

app.post('/signUp', urlencodedParser, async (req, res) => {
  const body = _.pick(req.body, ['email', 'password', 'username', 'phonenumber', 'city', 'department']);
  body.role = 'customer';
  var redirectTo = req.session.returnTo || '/';
  try {

    const user = new User(body);

    await user.save();
    const token = user.generateAuthToken().then((result) => {
      req.session.secureToken = result;
      req.session.isAuthorized = true;
      res.header('x-auth', result).redirect(redirectTo);
    });

  } catch(e) {
    res.render('sign-up.hbs', {
      title: 'Login',
      isLogin: true,
      user: body,
      errorMessage: 'Please, enter valid email and username',
      css: ['signup.css'],
      js: ['layout.js']
    });
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
    css: ['profile.css'],
    managers
  });

});

// display concrete manager in details
app.get('/admin/manager/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  const manager = await User.findOne({ _id: id });
  // console.log(manager);

  res.render('manager-details.hbs', {
    title: 'Manager',
    isAuthorized: req.session.isAuthorized,
    manager: manager,
    isAdmin: req.session.isAdmin,
    css: ['profile.css']
  });

});

// display manager addition admin page
app.get('/admin/add', authenticate, (req, res) => {

  res.render('admin-add.hbs', {
    title: 'Adding manager',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    css: ['admin-form.css'],
    js: ['layout.js']
  });

});

// handling manager addition admin page
app.post('/admin/add', urlencodedParser, authenticate, async (req, res) => {
  const body = _.pick(req.body, ['email', 'password', 'username', 'phonenumber']);

  try {
    const body = _.pick(req.body, ['email', 'password', 'username', 'phonenumber']);
    body.city = 'default';
    body.department = '00000';
    body.role = 'manager';
    const user = new User(body);

    await user.save();

    res.status(200).redirect('/admin');
  } catch(e) {
    res.render('admin-add.hbs', {
      title: 'Adding manager',
      isAuthorized: req.session.isAuthorized,
      isAdmin: req.session.isAdmin,
      user: body,
      errorMessage: 'Please, enter valid email and username',
      css: ['admin-form.css'],
      js: ['layout.js']
    });
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
    css: ['admin-form.css'],
    js: ['layout.js']
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

    res.redirect('/admin');
  } catch (e) {
    res.render('admin-edit.hbs', {
      title: 'Editing manager',
      isAuthorized: req.session.isAuthorized,
      isAdmin: req.session.isAdmin,
      errorMessage: 'Please, enter valid username',
      user: body,
      manager: manager,
      css: ['admin-form.css'],
      js: ['layout.js']
    });
    // req.session.returnTo = req.originalUrl;
    // res.redirect('/signIn');
  }
});


// handling manager deletion --- add deletion !!!!
app.get('/admin/remove/:email', authenticate, async (req, res) => {
  const email = req.params.email;

  const manager = await User.remove({ email });
  // console.log(manager);

  res.redirect('/admin');
});
// end of admin page region


// region of manager respondedMessage
app.get('/manager', authenticate, async (req, res) => {
  const manager = await User.findOne({ role: 'manager' });
  const offers = await Offer.find();

  res.render('manager.hbs', {
    title: 'Manager',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    css: ['profile.css'],
    offers
  });
});

// route for displation concrete offer details
app.get('/manager/offer/:id', urlencodedParser, authenticate, async (req, res) => {
  const id = req.params.id;
  const offer = await Offer.findOne({ _id: id });

  res.render('manager-offer.hbs', {
    title: 'Details',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    offer: offer,
    css: ['profile.css']
  });
});


// route changing offer's status to in progress
app.post('/manager/progress/:id', urlencodedParser, authenticate, async (req, res) => {
  const id = req.params.id;

  const result = await Offer.updateOne(
    {"_id": id},
    { $set : {
      "inProgress" : true } }
    );

    // console.log(result);

  res.redirect('/manager');
});

// route changing offer's status to completed
app.post('/manager/complete/:id', urlencodedParser, authenticate, async (req, res) => {
  const id = req.params.id;

  const result = await Offer.updateOne(
    {"_id": id},
    { $set : {
      "completed" : true } }
    );

    // console.log(result);

  res.redirect('/manager');
});

// route deleting offer by id
app.get('/manager/delete/:id', urlencodedParser, authenticate, async (req, res) => {
  const id = req.params.id;

  const offer = await Offer.remove({ _id: id });

  res.redirect('/manager');
});
// end of region


// test route for book response

app.get('/books/:query', async (request, response) => {
  // right method for displaying books
  //
  // const books = await Book.find();
  //
  // response.render('books.hbs', {
  //   title: 'books page',
  //   isAuthorized: request.session.isAuthorized || false,
  //   books: books,
  //   css: ['profile.css']
  // });

  // initial method view for initializing books database
  var query = request.params.query;
  var bookapiUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&format=json`;

  axios.get(bookapiUrl).then((res) => {
    var respondedBooks = [];

    if(res.error) {
      throw new Error('unable to get book response');
    }

    var books = res.data.items.filter((book) => book.accessInfo.pdf.isAvailable === true && book.saleInfo.saleability !== 'NOT_FOR_SALE');

    console.log(books);

    books.forEach((book) => {
      respondedBooks.push({
        id: book.id,
        title: book.volumeInfo.title,
        author: book.volumeInfo.authors[0],
        description: book.volumeInfo.description,
        image: book.volumeInfo.imageLinks.smallThumbnail,
        amount: book.saleInfo.listPrice.amount,
        downloadLink: book.accessInfo.pdf.acsTokenLink,
        readUrl: `https://books.google.com.ua/books?id=${book.id}&lpg=PP1&pg=PP1&output=embed`
      });
    });

    console.log(respondedBooks);

    respondedBooks.forEach((bookItem) => {
      const book = new Book(bookItem);

      book.save().then((result) => {
        console.log(result);
      }).catch((e) => {
        console.log(e);
        });
      });

    response.render('books.hbs', {
      title: 'books page',
      isAuthorized: request.session.isAuthorized || false,
      books: respondedBooks,
      css: ['profile.css']
    });

  }).catch((error) => {
    if(error.code === 'ENOTFOUND') {
      console.log('unable to connect to server');
    } else {
      console.log(error.message);
    }
  });

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

// displaying user offers routes
app.get('/offers', authenticate, async (req, res) => {
  const token = req.session.secureToken;

  const user = await User.findByToken(token);

  const offers = await Offer.find({customerEmail : user.email});

  res.render('user-offers.hbs', {
    title: 'User offers',
    isAuthorized: req.session.isAuthorized,
    isAdmin: req.session.isAdmin,
    css: ['profile.css'],
    offers
  });
});
// end of displaying user offers

// profile route region
app.get('/profile', authenticate, async (req, res) => {
  const token = req.session.secureToken;

  try {
    const user = await User.findByToken(token);

    res.render('profile.hbs', {
      title: 'Profile',
      user: user,
      css: ['profile.css'],
      isAuthorized: req.session.isAuthorized || false
    });
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
  }
});


app.get('/profile/edit', authenticate, async (req, res) => {
  const token = req.session.secureToken;

  try {
    const user = await User.findByToken(token);

    res.render('profile-edit.hbs', {
      title: 'Edit Profile',
      user: user,
      css: ['profile-edit.css'],
      js: ['layout.js'],
      isAuthorized: req.session.isAuthorized || false
    });
  } catch (e) {
    req.session.returnTo = req.originalUrl;
    res.redirect('/signIn');
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

    res.redirect('/profile');
  } catch (e) {
    res.render('profile-edit.hbs', {
      title: 'Edit Profile',
      user: body,
      errorMessage: 'Please, enter valid username.',
      css: ['profile-edit.css'],
      js: ['layout.js'],
      isAuthorized: req.session.isAuthorized || false
    });
    // req.session.returnTo = req.originalUrl;
    // res.redirect('/signIn');
  }
});
// end of profile route region


// function for asynchronous forEach
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}


app.listen(port, () => {
  console.log(`started on port ${port}`);
});


module.exports = {app};
