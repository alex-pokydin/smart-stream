var express = require('express');
var router = express.Router();

/* GET users listing. */
router.post('/bitrate', function(req, res, next) {
  if(res.app.cam){
    res.app.cam.getVideoEncoderConfigurations(function(err, confs, xml){

      confs.forEach(function(conf){
        if(conf.name == 'VideoE_000'){

          conf.rateControl.bitrateLimit = req.body.bitrate || 1000;
          
          res.app.cam.setVideoEncoderConfiguration(conf, function(err, conf, xml){
            res.status(200).json(conf);
          });

        }
      });

    });
  }else{
    res.status(500).json('error');
  }
});


/* GET users listing. */
router.post('/text', function(req, res, next) {
  if(res.app.cam){
    res.app.cam.setOSD({
      osdToken: 'CHNAME00',
      videoToken: '000', 
      text: req.body.text
    },function(err, data, xml){
      res.status(200).json(data);  
    });
  }else{
    res.status(500).json('error');
  }
});

/* GET users listing. */
router.get('/', function(req, res, next) {
  if(res.app.cam){
    res.app.cam.getVideoEncoderConfigurations(function(err, confs, xml){
      res.status(200).json(conf);
    });
  }else{
    res.status(500).json('error');
  }
});

module.exports = router;
