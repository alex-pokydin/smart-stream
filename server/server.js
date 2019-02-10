// call the packages we need
var createError = require('http-errors');
var express    = require('express');        // call express
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var debug = require('debug')('smart-stream:server');
var http = require('http');
var ffmpeg = require('./lib/ffmpeg');
var defaults = require('./lib/defaults');
var Cam = require('onvif').Cam;
var JsonDB = require('node-json-db');
var db = new JsonDB("config/conf", true, true);

var indexRouter = require('./routes/index');
var onvifRouter = require('./routes/onvif');

var app        = express();                 // define our app using express

app.ffmpeg = ffmpeg;
app.ffmpeg.start();
app.db = db;


// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));


app.use('/', require('./routes/web'));
app.use('/api', indexRouter);
app.use('/onvif', onvifRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */
var server = http.createServer(app);

server.listen(port);
console.log(`App started on port ${port}`);


defaults.init(app); 
var cfg = db.getData("/");
var conf = {
  hostname: cfg.ip || 'localhost',
  username: cfg.user || 'admin',
  password: cfg.pass || '',
  port: cfg.port || '8899'
};

debug(conf); 

new Cam(conf, function (err) {
  app.cam = this;
  if(!!err) return;

  this.setSystemDateAndTime({
      'dateTimeType': 'Manual',
      'daylightSavings': 'true',
      'timezone': 'EET-2EEST-3,M3.5.0/3,M10.5.0/4',
      'dateTime': new Date()
    }, function (err, date) {
      debug(date);
  });
});

  

/**
 * Listen on provided port, on all network interfaces.
 */


server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
