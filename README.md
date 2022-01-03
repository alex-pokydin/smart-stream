# Setup
create `streams.txt`
```
"IP" "YOUTUBE" "RTSP"
```

## install ffmpeg on WIN
download and uzip ffmpeg from official site
https://github.com/adaptlearning/adapt_authoring/wiki/Installing-FFmpeg
```
setx /M PATH "path\to\ffmpeg\bin;%PATH%"
```
do not forget to restart console and/or IDE


## notes

Background process output
```
tail -f /proc/<pid>/fd/1
```