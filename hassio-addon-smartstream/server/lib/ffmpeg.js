var debug = require("debug")("smart-stream:ffmpeg");
var os = require("os");
const { spawn } = require("node:child_process");
var progressStream = require("ffmpeg-progress-stream");

module.exports = (stream) => {
  var ffmpeg = {
    prev_time: false,
    ffmpeg_youtube: false,
    config: {},
    data: [],

    isRun: function () {
      var isRun =
      this.prev_time &&
      (this.ffmpeg_youtube !== false) &&
      Math.floor(new Date() - this.prev_time) < 20000;

      debug("isRun(): %o", {
        isRun, 
        prev_time: this.prev_time, 
        ffmpeg_youtube: (this.ffmpeg_youtube !== false), 
        time: Math.floor(new Date() - this.prev_time)
      });
      return isRun;
    },

    check_db: async function (start, stop) {
      start = start || function () {};
      stop = stop || function () {};

      if (await stream.get("autostart", false)) {
        ffmpeg.start();
        start();
      } else {
        ffmpeg.stop("No autostart!");
        stop();
      }

      let stats = ffmpeg.stats();
      stream.set('stats', stats);
      debug("%j", stats);
    },

    stats: function () {
      return ffmpeg.data && ffmpeg.data[0]
        ? {
            fps: parseInt(ffmpeg.data[0].fps),
            size: ffmpeg.data[0].size,
            time: ffmpeg.data[0].time,
            bit: ffmpeg.data[0].bitrate,
            speed: ffmpeg.data[0].speed,
            cpu: os.loadavg(),
          }
        : {};
    },
  };

  ffmpeg.params_youtube = async function () {
    var conf = ["-y"];

    if (await stream.get("audio")) {
      conf = conf.concat([
        "-thread_queue_size",
        "1000",
        "-f",
        "alsa",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-use_wallclock_as_timestamps",
        "1",
        "-i",
        "hw:0",
      ]);
    } else {
      conf = conf.concat([
        // '-f', 'lavfi',
        // '-i', 'anullsrc',
      ]);
    }

    conf = conf.concat([
      //'-thread_queue_size', '1000',
      "-rtsp_transport", "tcp",
      "-fflags", "+genpts", "-re",
      "-i",
      await stream.get("rtspUrl", ''),
      "-f", "lavfi",
      "-i", "anullsrc",
      "-use_wallclock_as_timestamps", "1",
      "-c:v", "copy",
      "-c:a", "aac",
      "-threads", "1",
      "-f", "flv",
      "rtmp://a.rtmp.youtube.com/live2/" + await stream.get("stream_id", ''),
    ]);
    return conf;
  };

  ffmpeg.stop = function (reason) {
    debug("Stopping! " + reason);
    ffmpeg.kill_stream(reason);

    // clear start interval
    clearInterval(ffmpeg.interval);

    // chcek db and start or stop
    setTimeout(ffmpeg.check_db, 10000);
  };

  ffmpeg.start = function () {
    if (ffmpeg.isRun()) {
      return;
    }
    
    ffmpeg.kill_stream("[start] !isRun()");
    debug("Start stream! - %s", stream.cam.hostname);
    ffmpeg.stream();

    clearInterval(ffmpeg.interval);
    ffmpeg.interval = setInterval(ffmpeg.check_db, 5000);
  };

  ffmpeg.kill_stream = function (reason) {
    debug(`Killing stream: ${reason}`);
    try {
      ffmpeg.ffmpeg_youtube.stderr.removeListener("close", ffmpeg.onClose);
      ffmpeg.ffmpeg_youtube.kill("SIGKILL");
    } catch (error) {
      debug("Cant kill!");
    }
    // used by isRun
    ffmpeg.prev_time = false;
  };

  ffmpeg.stream = async function () {
    ffmpeg.prev_time = new Date();
    var prev_frame = 0;
    var prev_time = 0;
    ffmpeg.data = [];

    let yt_params = (await ffmpeg.params_youtube());
    debug(yt_params.join(' '));
    ffmpeg.ffmpeg_youtube = spawn("ffmpeg", yt_params);

    ffmpeg.ffmpeg_youtube.stderr
      .pipe(progressStream())
      .on("data", function (data) {
        //debug("%o", data);
        var test = 0;
        var test_data = {
          fps: true,
          speed: true,
          frame: true,
        };
        // if (data.fps > 0 && data.fps < 5) {
        //     test_data.fps = false;
        //     test += 1;
        // }
        // if (parseFloat(data.speed) < 0.9 && data.fps > 0) {
        //     test_data.speed = false;
        //     test += 1;
        // }
        
        // no frames
        // if (prev_frame != 0 && data.frame == prev_frame) {
        //   test_data.frame = false;
        //   test += 1;
        //   debug({
        //     error: "prev_frame problem!!!!",
        //     frame: data.frame,
        //     prev: prev_frame,
        //   });
        // }
        if (prev_time != "" && data.time == prev_time) {
          test_data.time = false;
          test += 1;
          debug({
            error: "prev_time problem!!!!",
            time: data.time,
            prev: prev_time,
          });
        }
        test_data.frame = prev_frame;
        test_data.time = prev_time;
        prev_frame = data.frame;
        prev_time = data.time;
        data.test = test_data;
        data.ts = new Date();
        //console.log(JSON.stringify([data]));
        ffmpeg.data.unshift(data);
        ffmpeg.data = ffmpeg.data.slice(0, 5);

        if (test > 0) {
          debug(ffmpeg.data);
          if (ffmpeg.isRun()) {
            ffmpeg.ffmpeg_youtube.kill("SIGKILL");
          } else {
            debug("Nothing to kill!");
            ffmpeg.stop(`FFMPEG check failed: ${JSON.stringify([data])}`);
          }
        }

        ffmpeg.prev_time = new Date();
      });

    ffmpeg.ffmpeg_youtube.stderr.on("close", ffmpeg.onClose);
  };

  ffmpeg.onClose = function (code, signal) {
    debug(`child process terminated - code: ${code}, signal: ${signal}`);
    ffmpeg.stop("FFMPEG onClose event!");
  };

  debug('Init - %s', stream.cam.hostname);

  ffmpeg.check_db();

  return ffmpeg;
};
