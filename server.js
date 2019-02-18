const express = require('express');
const hbs = require('hbs');

const fs = require('fs');

const port = process.env.PORT || 3000;

var app = express();

hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');

app.use((request, response, next) => {
  var now = new Date().toString();
  var log = `${now}: ${request.method} ${request.url}`;

  console.log(log);
  fs.appendFile('server.log', log + '\n', (error) => {
    if(error) {
      console.log('unable to append to server.log');
    }
  });

  next();
});

// app.use((request, response, next) => {
//   response.render('maintenance.hbs');
// });

app.use(express.static(__dirname + '/public'));

hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear();
});

hbs.registerHelper('screamIt', (text) => {
  return text.toUpperCase();
});

app.get('/', (request, response) => {
  response.render('home.hbs', {
    pageTitle: 'welcome to main page',
    welcomeMessage: 'Nu darova stalker'
  });
});

app.get('/about', (request, response) => {
  response.render('about.hbs', {
    pageTitle: 'about page'
  });
});

app.get('/bad', (request, response) => {
  response.send({
    errorMessage: 'something bad has occurred'
  });
});

app.listen(port, () => {
  console.log(`server is up on port ${port}`);
});
