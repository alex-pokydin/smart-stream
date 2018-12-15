var debug = require('debug')('proj:server');
const {
    spawn
} = require('child_process');
var progressStream = require('ffmpeg-progress-stream');
var Cam = require('onvif').Cam;
var Camera = require('../models/camera');

var ffmpeg = {

    prev_time: false,
    ffmpeg_youtube: false,
    config: {},
    data: {},
    isRun: function(){
        var isRun = this.prev_time && (Math.floor(new Date() - this.prev_time) < 10000);
        return isRun;
    },
    cfg: function(param){
        if(!this.config){
            return false;
        }
        return this.config[param];
    }

};

ffmpeg.params_youtube = function(){

    var conf = [
        '-y',
    ];

    if( ffmpeg.cfg('audio') ){
        conf.concat([
            '-f', 'alsa',
            '-ar', '8000',
            '-ac', '1',
            '-rtbufsize', '1024',
            '-thread_queue_size', '1000',
            '-i', 'hw:0'
        ]);
    }else{
        conf.concat([
            '-f', 'lavfi',
            '-i', 'anullsrc',
        ]);
    }
        
    conf.concat([
        '-rtsp_transport', 'tcp',
        '-i', 'rtsp://' + ffmpeg.cfg('ip') + '/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-f', 'flv',
        'rtmp://a.rtmp.youtube.com/live2/' + ffmpeg.cfg('stream_id')
    ]);
    
    return conf;
} 

ffmpeg.stop = function () {
    debug('Stopping!');
    try {
        ffmpeg.ffmpeg_youtube.stderr.removeListener('close', ffmpeg.stop);
        ffmpeg.ffmpeg_youtube.kill('SIGKILL');
    } catch (error) {
        debug('Cant kill!');
    }
    
    ffmpeg.prev_time = false;

    clearInterval(ffmpeg.interval);

    Camera.findOne({}, (err , data) => {
        ffmpeg.config = data;
    });

    setTimeout(function () {
        if(ffmpeg.cfg('autostart') && !ffmpeg.isRun()){
            ffmpeg.start();
        }else{
            ffmpeg.stop();
        }
    }, 1000);
};

ffmpeg.start = function () {
    
    if(ffmpeg.isRun() ){
        return;
    }
    
    var prev_frame = 0;

    debug('Starting...');
    debug(ffmpeg.params_youtube().join(' '));
    
    clearInterval(ffmpeg.interval);
    
    ffmpeg.interval = setInterval(() => {
        
        if(ffmpeg.cfg('autostart') && !ffmpeg.isRun()){
            ffmpeg.start();
        }
        
        Camera.findOne({}, (err , data) => {
            ffmpeg.config = data;
            
            if ( !ffmpeg.cfg('autostart') && ffmpeg.isRun() ) {
                ffmpeg.ffmpeg_youtube.kill('SIGKILL');
            }
        });
        
    }, 5000);
    
    ffmpeg.ffmpeg_youtube = spawn('ffmpeg', ffmpeg.params_youtube());
    ffmpeg.ffmpeg_youtube.stderr
        .pipe(progressStream())
        .on('data', function (data) {
            //console.log( JSON.stringify([data.fps,parseFloat(data.speed), data.time]) );
            var test = 0;
            var test_data = {
                fps: true,
                speed: true,
                frame: true
            };
            if (data.fps > 0 && data.fps < 5) {
                test_data.fps = false;
                test += 1;
            }
            if (parseFloat(data.speed) < 0.9 && data.fps > 0) {
                test_data.speed = false;
                test += 1;
            }
            if ((prev_frame != 0) && (data.frame == prev_frame)) {
                test_data.frame = false;
                test += 1;
            }
            test_data.frame = prev_frame;
            prev_frame = data.frame;
            data.test = test_data;
            console.log(JSON.stringify([data]));
            ffmpeg.data = data;

            if (test > 0) {
                if (ffmpeg.isRun()) {
                    ffmpeg.ffmpeg_youtube.kill('SIGKILL');
                } else {
                    debug('Nothing to kill!');
                    ffmpeg.stop();
                }

            }

            ffmpeg.prev_time = new Date();
        });
    
    ffmpeg.ffmpeg_youtube.stderr.on('close', ffmpeg.stop);
};

Camera.findOne({}, (err , data) => {
    ffmpeg.config = data;
});

module.exports = ffmpeg;