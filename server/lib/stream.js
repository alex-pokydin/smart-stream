var debug = require("debug")("smart-stream:stream");

module.exports = {
  app: null,
  db: null,
  onvif: null,
  ffs: {},

  init: async function (app) {
    this.app = app;
    this.db = app.db;
    this.onvif = app.onvif;

    app.stream = this;
    this.interval = setInterval(this.check.bind(this), 5000);
  },

  check: async function () {
    this.db.getCams().then((cams) => {
      for (let i in cams) {
        if (this.stream(cams[i]) === false) {
          delete this.ffs[cams[i]?.hostname];
        }
      }
    });
  },

  stream: async function (cam) {
    let me = this;

    if (!cam.autostart || this.ffs[cam.hostname]?.isRun()) return false;

    if (this.ffs[cam.hostname]) return true;

    let Cam = await this.onvif.getCam(cam).catch(debug);
    if (!Cam) return false;

    let stream = {
      cam: Cam,
      get: async (key, def) =>
        (await me.db.get(`cams/${cam.hostname}/${key}`).catch(debug)) || def,
      set: async (key, value) =>
        await me.db.set(`cams/${cam.hostname}/${key}`, value),
    };

    stream.set(
      "rtspUrl",
      await new Promise((resolve, reject) => {
        Cam.getStreamUri({ protocol: "RTSP" }, function (err, stream) {
          if (err) reject(err);
          resolve(stream.uri);
        });
      })
    );

    stream.set(
      "snapshotUrl",
      await new Promise((resolve, reject) => {
        Cam.getSnapshotUri({ protocol: "RTSP" }, function (err, stream) {
          if (err) reject(err);
          resolve(stream.uri);
        });
      })
    );

    this.ffs[cam.hostname] = require("./ffmpeg")(stream);
    return true;
  },
};
