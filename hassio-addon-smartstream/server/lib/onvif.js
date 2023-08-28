var {Discovery, Cam} = require("onvif");

module.exports = {
  app: null,
  db: null,

  init: async function (app) {
    this.app = app;
    this.db = app.db;
    app.onvif = this;

    return await new Promise((resolve, reject) => {
      Discovery.probe({ device: "eth0" }, async function (err, cams) {
        // function will be called only after timeout (5 sec by default)
        if (err) {
          reject(err);
        }
        await app.db.setCams(cams);
        resolve(cams);
      });
    });
  },

  getCam: function (opts) {
    opts.username = opts.username || "admin";
    return new Promise((resolve, reject) => {
      new Cam(opts, function (err) {
        if (err) {
          reject(err);
        }
        resolve(this);
      });
    });
  },
};
