// server.js
// where your node app starts

var users = {};

var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;


passport.use(new GoogleStrategy({
  clientID: process.env.G_CLIENT_ID,
  clientSecret: process.env.G_CLIENT_SECRET,
  callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/google/return',
  scope: ['https://www.googleapis.com/auth/plus.me','https://www.googleapis.com/auth/userinfo.email']
},
function(token, tokenSecret, profile, cb) {
  return cb(null, profile);
}));

var AmazonStrategy = require('passport-amazon').Strategy

passport.use(new AmazonStrategy({
  clientID: process.env.A_CLIENT_ID,
  clientSecret: process.env.A_CLIENT_SECRET,
  callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/amazon/return',
  scope: ['profile']
},
function(token, tokenSecret, profile, cb) {
  return cb(null, profile);
}));


passport.serializeUser(function(user, done) {
  users[user.id] = user;
  done(null, user.id);
  
});
passport.deserializeUser(function(id, done) {
  console.log("looking up %s", id);  
  var user = users[id];
  done(null, user);
});

// init project
var express = require('express');
var app = express();
var expressSession = require('express-session');

// cookies are used to save authentication
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

app.set('view engine', 'pug');

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(expressSession({ secret:'watchingfairies', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// index route
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(req, res) {
    console.log("doing logoff of " + req.user.id);
    // https://stackoverflow.com/questions/13758207/why-is-passportjs-in-node-not-removing-session-on-logout
    res.clearCookie('connect.sid');
    req.logout();
    res.redirect('/');
  }
);

app.get('/auth/google', passport.authenticate('google'));

app.get('/auth/amazon', passport.authenticate('amazon'));

app.get('/login/google/return', 
  passport.authenticate('google', 
    { successRedirect: '/setcookie', failureRedirect: '/' }
  )
);

app.get('/login/amazon/return', 
  passport.authenticate('amazon', 
    { successRedirect: '/setcookie', failureRedirect: '/' }
  )
);



// on successful auth, a cookie is set before redirecting
// to the success view
app.get('/setcookie', requireLogin,
  function(req, res) {  
    if(req.user.id) {
      console.log("have user %s", req.user.id);
      res.redirect('/success');
    } else {
       console.log("busted")
       res.redirect('/');
    }
  }
);

// if cookie exists, success. otherwise, user is redirected to index
app.get('/success.old', requireLogin,
  function(req, res) {
    res.sendFile(__dirname + '/views/success.html');
  }
);

app.get('/success', requireLogin, function(req, res) {
  res.render("success", {"u": req.user});
});


function requireLogin (req, res, next) {
  if (!req.user) {
    res.redirect('/');
  } else {
    next();
  }
};

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
