var express = require('express');
var Camera = require('../models/camera');
var router = express.Router();
var debug = require('debug')('proj:server');


/* GET home page. */
router.get('/', function(req, res, next) {
  Camera.findOne({}, (err , data) => {
    res.status(200).json({data});
  });
});

/* GET home page. */
router.get('/start', function(req, res, next) {
  res.app.ffmpeg.start();
  res.status(200).json({});
});

router.get('/data', function(req, res, next) {
  res.status(200).json( res.app.ffmpeg.data );
});


router.post('/', (req, res, next) => {
  Camera.findOne({}, (err , data) => {
    var restart = false;
    if(req.body.ip) {
      data.ip = req.body.ip;
      restart = true;
    }
    if(req.body.stream_id) {
      data.stream_id = req.body.stream_id;
      restart = true;
    }
    if(req.body.autostart) {
      data.autostart = req.body.autostart;
      restart = true;
    }
    data.save(debug);
    res.status(200).json({data});
    if(restart){
      res.app.ffmpeg.stop( );
    }
  });
});

module.exports = router;
