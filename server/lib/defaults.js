var debug = require('debug')('proj:server');
var Camera = require('../models/camera');

module.exports = {

    init: function(){
        Camera.findOne({}, (err, data) => {
            if (!data) {
                const m = new Camera;
                m.ip = '192.168.3.10:554';
                m.autostart = true;
                m.save(debug);
            }
        });
    }
    
};