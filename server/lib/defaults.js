var debug = require('debug')('proj:server');

module.exports = {

    init: async function(app){
        if (!(await app.storage.getItem('ip'))) {
            await app.storage.setItem('ip', '192.168.3.10');
        }
        if (!(await app.storage.getItem('user'))) {
            await app.storage.setItem('user', 'admin');
        }
        if (!(await app.storage.getItem('pass'))) {
            await app.storage.setItem('pass', '');
        }
        if (!(await app.storage.getItem('port'))) {
            await app.storage.setItem('port', '8899');
        }
        if (!(await app.storage.getItem('autostart'))) {
            await app.storage.setItem('autostart', false);
        }
        
    }
    
};