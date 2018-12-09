var express = require('express');
var Camera = require('../models/camera');
var router = express.Router();
var debug = require('debug')('proj:server');
var ffmpeg = require('../lib/ffmpeg');


/* GET home page. */
router.get('/', function(req, res, next) {
  Camera.findOne({}, (err , data) => {
    res.status(200).json({data});
  });
});

/* GET home page. */
router.get('/start', function(req, res, next) {
  ffmpeg.start();
  res.status(200).json({});
});


router.post('/', (req, res, next) => {
  const m = new Camera;
  m.name = 'hello';
  m.save(debug);
  res.status(200).json({});
});

module.exports = router;
