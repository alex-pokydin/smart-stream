var express = require('express');
var router = express.Router();
var debug = require('debug')('smart-stream:web');


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'Welcome'
    });
});


module.exports = router;