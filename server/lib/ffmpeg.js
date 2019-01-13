var debug = require('debug')('smart-stream:ffmpeg');
var os = require('os');
const { spawn } = require('child_process');
var progressStream = require('ffmpeg-progress-stream');
var JsonDB = require('node-json-db');
var db = new JsonDB("config/conf", true, true);


var ffmpeg = {

    prev_time: false,
    ffmpeg_youtube: false,
    config: {},
    data: [],
    isRun: function(){
        var isRun = this.prev_time 
            && (this.ffmpeg_youtube !== false)
            && (Math.floor(new Date() - this.prev_time) < 2000);
        return isRun;
    },
    cfg: function(param){
        return ffmpeg.config[param];
    },
    check_db: function(start, stop){
        start = start || function(){};
        stop = stop || function(){};
        db.reload();
        ffmpeg.config = db.getData("/");

        if( ffmpeg.cfg('autostart') ){
            ffmpeg.start();
            start();
        } else {
            ffmpeg.stop('Need to stop by autostart!');
            stop();
        }

        debug('%j',ffmpeg.stats());
    },
    stats: function(){
        return ffmpeg.data && ffmpeg.data[0] 
            ? {
                fps: ffmpeg.data[0].fps,
                size: ffmpeg.data[0].size,
                time: ffmpeg.data[0].time,
                bit: ffmpeg.data[0].bitrate,
                speed: ffmpeg.data[0].speed,
                cpu: os.loadavg(),
                mem: Math.floor(os.totalmem()/1024/1024),
                free: Math.floor(os.freemem()/1024/1024)
            } 
            : {};
    }

};

ffmpeg.params_youtube = function(){

    var conf = [
        '-y',
    ];

    if( ffmpeg.cfg('audio') ){
        conf = conf.concat([
            '-thread_queue_size', '4000',
            '-f', 'alsa',
            '-ar', '44100',
            '-ac', '1',
            '-use_wallclock_as_timestamps', '1',
            '-i', 'hw:0'
        ]);
    }else{
        conf = conf.concat([
            '-f', 'lavfi',
            '-i', 'anullsrc',
        ]);
    }
        
    conf = conf.concat([
        '-thread_queue_size', '4000',
        '-rtsp_transport', 'tcp',
        '-use_wallclock_as_timestamps', '1',
        '-i', 'rtsp://' + ffmpeg.cfg('ip') + ':554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-f', 'flv',
        'rtmp://a.rtmp.youtube.com/live2/' + ffmpeg.cfg('stream_id')
    ]);

    return conf;
} 

ffmpeg.stop = function (reason) {
    debug('Stopping! ' + reason);
    ffmpeg.kill_stream();

    // clear start interval
    clearInterval(ffmpeg.interval);

    // chcek db and start or stop
    setTimeout(ffmpeg.check_db, 5000);
};

ffmpeg.start = function () {
    
    if( ffmpeg.isRun() ){
        return;
    }else{
        ffmpeg.kill_stream();
    }
    
    if(!ffmpeg.isRun() ){
        debug('Start stream!');
        ffmpeg.stream(); 
    }

    clearInterval(ffmpeg.interval);
    ffmpeg.interval = setInterval(ffmpeg.check_db, 5000);

};

ffmpeg.kill_stream = function(){
    debug('Killing stream');
    try {
        ffmpeg.ffmpeg_youtube.stderr.removeListener('close', ffmpeg.onClose);
        ffmpeg.ffmpeg_youtube.kill('SIGKILL');
    } catch (error) {
        debug('Cant kill!');
    }
    // used by isRun
    ffmpeg.prev_time = false;
}


ffmpeg.stream = function(){

    ffmpeg.prev_time = new Date();
    var prev_frame = 0;
    var prev_time = 0;

    debug(ffmpeg.params_youtube().join(' '));
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
            if ((prev_time != '') && (data.time == prev_time)) {
                test_data.time = false;
                test += 1;
            }
            test_data.frame = prev_frame;
            test_data.time = prev_time;
            prev_frame = data.frame;
            prev_time = data.time;
            data.test = test_data;
            data.ts = new Date();
            //console.log(JSON.stringify([data]));
            ffmpeg.data.unshift( data );
            ffmpeg.data = ffmpeg.data.slice(0,5);

            if (test > 0) {
                debug(ffmpeg.data);
                if (ffmpeg.isRun()) {
                    ffmpeg.ffmpeg_youtube.kill('SIGKILL');
                } else {
                    debug('Nothing to kill!');
                    ffmpeg.stop(`FFMPEG check failed: ${JSON.stringify([data])}`);
                }

            }

            ffmpeg.prev_time = new Date();
        });
    
    ffmpeg.ffmpeg_youtube.stderr.on('close', ffmpeg.onClose);
}

ffmpeg.onClose = function(code, signal){
    debug(`child process terminated - code: ${code}, signal: ${signal}`);
    ffmpeg.stop('FFMPEG onClose event!');
}

debug('Starting...');
clearInterval(ffmpeg.interval);
ffmpeg.interval = setInterval(ffmpeg.check_db, 5000);

module.exports = ffmpeg;