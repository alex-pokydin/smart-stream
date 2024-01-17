var debug = require("debug")("smart-stream:db");
var { JsonDB, Config } = require("node-json-db");

module.exports = {
  app: null,
  db: new JsonDB(new Config("/data/conf", true, true, "/"), true, true),
  conf: null,

  init: async function (app) {
    this.app = app;
    app.db = this;
    return this.get()
      .then((data) => (this.conf = data))
      .catch((err) => {
        this.conf = { cams: [] };
        debug("Init config: %o", this.conf);
        return this.db.push("/", this.conf).catch(debug);
      });
  },

  get: function (param = "") {
    this.db.reload().catch(debug);
    return this.db.getData("/" + param).then((data) => {
      debug('get("/%s") = %s...', param, JSON.stringify(data).substring(0, 40));
      return data;
    }).catch((err) => {
      debug('get("/%s") Error: %o', param, err.message);
      return null;
    });
  },

  set: async function (param, value) {
    this.db.reload().catch(debug);
    return this.db.push("/" + param, value).then(() => {
      debug('set("/%s") = %o', param, value);
      return value;
    });
  },

  del: async function (param) {
    this.db.reload().catch(debug);
    return this.db.delete("/" + param).then(() => {
      debug('del("/%s")', param);
      return true;
    });
  },

  setCams: async function (cams) {
    for (let i in cams) {
      let cam = await this.get(`cams/${cams[i].hostname}`).catch(debug);
      if (!cam) {
        cam = {
          hostname: cams[i].hostname,
          port: cams[i].port,
          username: cams[i].username || "admin",
          password: cams[i].password || "",
        };
        await this.set(`cams/${cams[i].hostname}`, cam).catch(debug);
      }
    }
  },

  getCams: async function () {
    return this.get("cams");
  },

  getCam: function (hostname) {
    let get = async (key, def) =>
      (await this.get(`cams/${hostname}/${key}`).catch(debug)) || def;
    let set = async (key, value) =>
      await this.set(`cams/${hostname}/${key}`, value);
    let del = async () =>
      await this.del(`cams/${hostname}`);
    
      return {
      get,
      set,
      del,
      toggle: async () => set("autostart", !(await get("autostart", false))),
    };
  },

  addCam: async function (cam) {
    return this.set(`cams/${cam.hostname}`, {
      hostname: cam.hostname,
      port: cam.port,
      username: cam.username || "admin",
      password: cam.password || "",
    });
  },
};
