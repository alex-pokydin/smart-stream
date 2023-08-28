var express = require('express');
var router = express.Router();
var debug = require('debug')('smart-stream:index');


/* GET home page. */
router.get('/', function(req, res, next) {
  Camera.findOne({}, (err , data) => {
    res.status(200).json({data});
  });
});

/* GET home page. */
router.get('/start', function(req, res, next) {
  res.app.ffmpeg.start();
  res.status(200).json('starting');
});

/* GET home page. */
router.get('/stop', function(req, res, next) {
  res.app.ffmpeg.stop();
  res.status(200).json('stoping');
});

router.get('/data', function(req, res, next) {
  res.status(200).json( {
    'total': res.app.ffmpeg.data.length,
    'data': res.app.ffmpeg.data 
  });
});


router.post('/', (req, res, next) => {
  var restart = false;
  if(req.body.ip) {
    res.app.db.push("/ip",req.body.ip);
    restart = true;
  }
  if(req.body.stream_id) {
    res.app.db.push("/stream_id",req.body.stream_id);
    restart = true;
  }
  if(req.body.autostart) {
    res.app.db.push("/autostart",JSON.parse(req.body.autostart));
    restart = true;
  }
  if(req.body.audio) {
    res.app.db.push("/audio",JSON.parse(req.body.audio));
    restart = true;
  }
  res.status(200).json( res.app.db.getData("/") );
  if(restart){
    res.app.ffmpeg.stop( );
  }
});

module.exports = router;
