// app/models/camera.js

var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var CameraSchema   = new Schema({
    name: String,
    ip: String,
    stream_id: String,
    audio: Boolean,
    autostart: Boolean,
    user: String,
    pass: String
});

module.exports = mongoose.model('Camera', CameraSchema);