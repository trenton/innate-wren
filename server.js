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
},
function(token, tokenSecret, profile, cb) {
  return cb(null, profile);
}));

var OAuth2CognitoStrategy = require('passport-oauth2-cognito').Strategy
passport.use(new OAuth2CognitoStrategy({
  clientDomain: 'https://' + process.env.COGNITO_WREN001_CLIENT_DOMAIN + '/',
  clientID: process.env.COGNITO_WREN001_CLIENT_ID,
  clientSecret: process.env.COGNITO_WREN001_CLIENT_SECRET,
  region: process.env.COGNITO_WREN001_REGION,
  callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/cognitowren001/return',
  scope: 'openid'
},
function(token, tokenSecret, profile, done) {
  console.log("profile: " + JSON.stringify(profile));
  console.log("token: " + JSON.stringify(token));
  console.log("tokenSecret: " + JSON.stringify(tokenSecret));
  console.log("after");
  profile.token = token;
  
  var AWS = require('aws-sdk');
  AWS.config.update({region: process.env.REGION});
  
  const idp = 'cognito-idp.us-east-1.amazonaws.com/' + process.env.COGNITO_WREN001_POOL_ID;

  let ci = new AWS.CognitoIdentity();
  var params = {
    IdentityPoolId: process.env.COGNITO_WREN001_IDENTITY_POOL_ID,
    Logins: {
      idp: token,
    }
  };
  ci.getOpenIdTokenForDeveloperIdentity(params, function(err, data) {
    if (err) console.error(err, err.stack); 
    else     console.log(data);           
  });
  
  return done(null, profile);
}));


passport.serializeUser(function(user, done) {
  // console.log("the user: " + JSON.stringify(user));
  
  var the_id = user.id;
  if('sub' in user) {
    the_id = user.sub;
    user.provider = process.env.COGNITO_WREN001_CLIENT_ID;
  }
  
  users[the_id] = user;
  
  /*
  if('sub' in user) {
    users[user.sub] = user
  }
  else {
    users[user.id] = user;
  }  
  */
  
  done(null, the_id);
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

app.get('/auth/google', passport.authenticate('google'));
app.get('/login/google/return', 
  passport.authenticate('google', 
    { successRedirect: '/setcookie', failureRedirect: '/' }
  )
);

app.get('/auth/amazon', passport.authenticate('amazon'));
app.get('/login/amazon/return', 
  passport.authenticate('amazon', 
    { successRedirect: '/setcookie', failureRedirect: '/' }
  )
);

app.get('/auth/cognitowren001', passport.authenticate('oauth2-cognito'));
app.get('/login/cognitowren001/return', 
  passport.authenticate('oauth2-cognito', 
    { successRedirect: '/setcookie', failureRedirect: '/' }
  )
);

app.get('/auth/userpoolland', (req, res) => {
  console.log("here!!!");
  
  console.log(req.url);
  
  // validate token
  
  res.redirect('/home');
  
});

// index route
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

// awssdk
app.get('/awssdk', function(req, res) {
  res.sendFile(__dirname + '/views/awssdk.html');
});


// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(req, res) {
    console.log("doing logoff");
    // https://stackoverflow.com/questions/13758207/why-is-passportjs-in-node-not-removing-session-on-logout
    res.clearCookie('connect.sid');
    req.logout();
    res.redirect('/');
  }
);

// on successful auth, a cookie is set before redirecting
// to the success view
app.get('/setcookie', requireLogin,
  function(req, res) {  
    // :TODO: nasty hack
    if(req.user.id || req.user.sub) {
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
  res.render("success", {"u": req.user, "cognito_pool_id": process.env.COGNITO_WREN001_POOL_ID});
});

app.get('/home', (req, res) => {
  res.render("home", {
    "aws_region": process.env.COGNITO_WREN001_REGION, 
    "aws_user_pool_id": process.env.COGNITO_WREN001_POOL_ID,
    "aws_identity_pool_id": process.env.COGNITO_WREN001_IDENTITY_POOL_ID,
  });
});


function requireLogin (req, res, next) {
  if (!req.user) {
    console.log("no req.user");
    res.redirect('/');
  } else {
    next();
  }
};

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
