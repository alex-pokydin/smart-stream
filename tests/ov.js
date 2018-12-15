var Cam = require('onvif').Cam; 

console.log('start'); 

new Cam({
  hostname: '192.168.3.10',
  username: 'admin',
  password: '',
  port: '8899'
}, function(err) {
  console.log('connected');
  console.log(this);
  //this.absoluteMove({x: 1, y: 1, zoom: 1});
  
  
});
