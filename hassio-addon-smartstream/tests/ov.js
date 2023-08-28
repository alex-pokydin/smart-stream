var
  http = require('http'),
  Cam = require('onvif').Cam;

new Cam({
  hostname: '192.168.6.121',
  username: 'admin',
  password: '',
  port: '8899'
}, function(err) {
  this.getStreamUri({protocol:'RTSP'}, function(err, stream) {
    console.log(stream);
  });
  this.getSnapshotUri({}, function(err, res) {
    console.log(res);
  });
});
