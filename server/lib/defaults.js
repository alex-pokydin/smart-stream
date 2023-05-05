var debug = require('debug')('smart-stream:defaults');

module.exports = {

    init: async function(app){ 
        var conf ={};
        try {
            conf = await app.db.getData("/");
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
        
        debug('config: %O', conf);
        app.db.push("/",conf); 
    }
    
};
