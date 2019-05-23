//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    cors = require( 'cors' ),
    cfenv = require( 'cfenv' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    jwt = require( 'jsonwebtoken' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var settings = require( './settings' );

var appEnv = cfenv.getAppEnv();

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/public' );
app.set( 'view engine', 'ejs' );

app.use( cors() );

app.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,           //. https で使う場合は true
    maxage: 1000 * 60 * 60   //. 60min
  }
}) );


app.get( '/slack/login', function( req, res ){
  if( req.session.oauth ){
    res.redirect( '/' );
  }else{
    res.redirect( 'https://slack.com/oauth/authorize?client_id=' + settings.slack_client_id + '&scope=chat:write:user,files:write:user,channels:read' );
  }
});

app.get( '/slack/callback', function( req, res, next ){
  var code = req.query.code;
  if( code ){
    var option = {
      url: 'https://slack.com/api/oauth.access?client_id=' + settings.slack_client_id + '&client_secret=' + settings.slack_client_secret + '&code=' + code,
      method: 'GET'
    };
    request( option, ( err0, res0, body0 ) => {
      if( err0 ){
        return res.status( 403 ).send( { status: false, error: err0 } );
      }else{
        body0 = JSON.parse( body0 );
        var access_token = body0.access_token;

        req.session.oauth = {};
        req.session.oauth.provider = 'slack';
        req.session.oauth.user_id = body0.user_id;
        req.session.oauth.team_id = body0.team_id;
        req.session.oauth.team_name = body0.team_name;
        req.session.oauth.access_token = body0.access_token;

        var token = jwt.sign( req.session.oauth, settings.superSecret, { expiresIn: '25h' } );
        req.session.token = token;
        //res.send( "Worked." );
        res.redirect( '/' );
      }
    });
  }else{
    //next( new Error( "you are not supposed to be here." ) );
    res.redirect( '/' );
  }
});

app.get( '/slack/logout', function( req, res ){
  req.session.token = null;
  req.session.oauth = null;
  //res.redirect( '/' );
  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});


app.get( '/', function( req, res ){
  if( req.session && req.session.token ){
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, oauth ){
      if( !err && oauth ){
        //console.log( oauth );
        res.render( 'index', { oauth: oauth } );
      }else{
        console.log( err );
        res.render( 'index', { oauth: null } );
      }
    });
  }else{
    res.render( 'index', { oauth: null } );
  }
});

app.get( '/channels', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.session && req.session.token ){
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, oauth ){
      if( !err && oauth ){
        //. https://api.slack.com/methods/channels.list
        var option = {
          url: 'https://slack.com/api/channels.list?token=' + oauth.access_token + '&pretty=1',
          method: 'GET'
        };
        request( option, ( err0, res0, body0 ) => {
          if( err0 ){
            return res.status( 403 ).send( { status: false, error: err0 } );
          }else{
            body0 = JSON.parse( body0 );
            //. body0 = { "ok": true, "channels": [] }
            var channels = [];
            body0.channels.forEach( function( channel ){
              if( channel.is_channel ){
                channels.push( channel );
              }
            });
            var p = JSON.stringify( { status: true, channels: channels }, null, 2 );
            res.write( p );
            res.end();
          }
        });
      }else{
        var p = JSON.stringify( { status: false, error: err }, null, 2 );
        res.status( 400 );
        res.write( p );
        res.end();
      }
    });
  }else{
    var p = JSON.stringify( { status: false, error: 'No session found.' }, null, 2 );
    res.status( 400 );
    res.write( p );
    res.end();
  }
});

app.post( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.session && req.session.token ){
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, oauth ){
      if( !err && oauth ){
        var imgpath = req.file.path;
        var imgtype = req.file.mimetype;
        //var imgsize = req.file.size;
        var ext = imgtype.split( "/" )[1];
        var imgfilename = req.file.filename;
        var filename = req.file.originalname;
        var userId = req.body.userId;
        var channel_id = req.body.channel_id;

        //https://www.utali.io/entry/2016/10/07/172806
        //. 画像を /api/files.upload にポスト
        var formData = {
          'file': fs.createReadStream( imgpath )
        };
        var params = 'token=' + oauth.access_token
          + '&channels=' + channel_id
          + '&filename='
          + '&initial_comment='
          + '&title=';
        //console.log( 'params = ' + params );
        request.post( { url: 'https://slack.com/api/files.upload?' + params, formData: formData }, function( err, res1, body ){
          fs.unlink( imgpath, function(e){} );
          if( err ){
            console.log( err );
            var p = JSON.stringify( { status: false, error: err }, null, 2 );
            res.status( 400 );
            res.write( p );
            res.end();
          }else{
            //. body = { "ok": false, "error": "invalid_auth" }
            body = JSON.parse( body );
            //console.log( body );
            var p = JSON.stringify( { status: true, body: body }, null, 2 );
            res.write( p );
            res.end();
          }
        });
      }else{
        var p = JSON.stringify( { status: false, error: err }, null, 2 );
        res.status( 400 );
        res.write( p );
        res.end();
      }
    });
  }else{
    var p = JSON.stringify( { status: false, error: 'No session found.' }, null, 2 );
    res.status( 400 );
    res.write( p );
    res.end();
  }
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}

function compareByTimestamp( a, b ){
  var r = 0;
  if( a.timestamp < b.timestamp ){ r = -1; }
  else if( a.timestamp < b.timestamp ){ r = 1; }

  return r;
}


app.listen( appEnv.port );
console.log( "server stating on " + appEnv.port + " ..." );
