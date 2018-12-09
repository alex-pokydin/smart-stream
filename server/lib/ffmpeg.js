var debug = require('debug')('proj:server');
const {
    spawn
} = require('child_process');
var progressStream = require('ffmpeg-progress-stream');
var Cam = require('onvif').Cam;
var config = require('./config.json');
var Camera = require('../models/camera');

var ffmpeg = {

    ffmpeg_youtube: false,
    data: {},

};

ffmpeg.params_youtube = function(){
    debug( ffmpeg.data.stream_id);

    return [
        '-y',
        // '-f', 'alsa',
        // '-ar', '8000',
        // '-ac', '1',
        // '-rtbufsize', '1024',
        // '-thread_queue_size', '1000',
        // '-i', 'hw:0',

        '-f', 'lavfi',
        '-i', 'anullsrc',

        '-rtsp_transport', 'tcp',
        '-i', 'rtsp://192.168.3.10:554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-f', 'flv',
        'rtmp://a.rtmp.youtube.com/live2/' + ffmpeg.data.stream_id
    ];
} 

ffmpeg.ffmpeg_stop = function () {
    debug('Stopped!');
    try {
        ffmpeg.ffmpeg_youtube.stderr.removeListener('close', ffmpeg.ffmpeg_stop);
        ffmpeg.ffmpeg_youtube.kill('SIGKILL');
    } catch (error) {
        debug('Cant kill!');
    }
    
    clearInterval(ffmpeg.interval);

    Camera.findOne({}, (err , data) => {
        ffmpeg.data = data;
    });

    setTimeout(function () {
        if(ffmpeg.data.autostart){
            ffmpeg.start();
        }else{
            ffmpeg.ffmpeg_stop();
        }
    }, 5000);
};

ffmpeg.start = function () {

    if(!ffmpeg.data.autostart){
        ffmpeg.ffmpeg_stop();
    }

    var prev_frame = 0;
    var prev_time = new Date();

    debug('Starting...');
    debug(ffmpeg.params_youtube().join(' '));

    ffmpeg.ffmpeg_youtube = spawn('ffmpeg', ffmpeg.params_youtube());

    ffmpeg.interval = setInterval(() => {
        
        Camera.findOne({}, (err , data) => {
            ffmpeg.data = data;
        });

        if ( (Math.floor(new Date() - prev_time) > 10000)
            || (!ffmpeg.data.autostart) ) {
            ffmpeg.ffmpeg_youtube.kill('SIGKILL');
        }
    }, 5000);

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

            if (test > 0) {
                if (ffmpeg.ffmpeg_youtube) {
                    ffmpeg.ffmpeg_youtube.kill('SIGKILL');
                } else {
                    debug('Nothing to kill!');
                    ffmpeg.ffmpeg_stop();
                }

            }

            prev_time = new Date();
        });
    
    ffmpeg.ffmpeg_youtube.stderr.on('close', ffmpeg.ffmpeg_stop);
};

Camera.findOne({}, (err , data) => {
    ffmpeg.data = data;
    ffmpeg.start();
});

module.exports = ffmpeg;