var debug = require('debug')('proj:server');

module.exports = {

    init: function(app){ 
        var conf ={};
        try {
            conf = app.db.getData("/");
        } catch(error) {
            console.error(error);
        };
        
        conf.ip = conf.ip || '192.168.3.10';
        conf.user = conf.user || 'admin';
        conf.pass = conf.pass || '';
        conf.port = conf.port || '8899';
        conf.autostart = conf.autostart || false;
        conf.audio = conf.audio || false;
        conf.stream_id = conf.stream_id || false;
        
        app.db.push("/",conf); 
    }
    
};