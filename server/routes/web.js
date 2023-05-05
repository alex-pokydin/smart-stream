var express = require("express");
var router = express.Router();
var debug = require("debug")("smart-stream:web");

/* GET home page. */
router.get("/", async function (req, res, next) {
  res.render("index", {
    title: "Welcome",
    cameras: await req.app.db.get("cams").catch(() => []),
  });
});

router.post("/", async function (req, res, next) {
    let params = req.body;
    let cam = await req.app.db.get(`cams/${params.hostname}`).catch(debug);
    if (cam) {
      return res.redirect("/");
    }
    cam = await req.app.onvif.getCam(params).catch(debug);
    if (cam) {
      await req.app.db.addCam(cam).catch(debug);
    }
    return res.redirect("/");
  });

  router.post("/:hostname/auto", async function (req, res, next) {
    let cam = req.app.db.getCam(req.params.hostname);
    await cam.toggle().catch(debug);
    return res.redirect("/");
  });

  router.post("/:hostname/stream_id", async function (req, res, next) {
    let cam = req.app.db.getCam(req.params.hostname);
    await cam.set('stream_id', req.body.stream_id).catch(debug);
    return res.redirect("/");
  });

module.exports = router;
