#!/bin/sh

# ffmpeg \
#   -f image2 -loop 1 -i input.jpg -re \
#   -f lavfi -i anullsrc \
#   -vf format=yuv420p -c:v libx264 -b:v 2000k -maxrate 2000k -bufsize 4000k -g 50 -c:a aac \
#   -f flv rtmp://a.rtmp.youtube.com/live2/46ku-tg38-umc5-wuyj-ar3b

ffmpeg \
  -fflags +genpts \
  -re \
  -stream_loop -1 -i input.mp4 \
  -f lavfi -i anullsrc \
  -use_wallclock_as_timestamps 1 \
  -c:v copy \
  -c:a aac \
  -f flv rtmp://a.rtmp.youtube.com/live2/46ku-tg38-umc5-wuyj-ar3b


# ffmpeg \
#   -fflags +genpts \
#   -re \
#   -stream_loop -1 -i input.mp4 \
#   -f lavfi -i anullsrc \
#   -use_wallclock_as_timestamps 1 \
#   -c:v copy -b:v 2000k -maxrate 2000k -bufsize 4000k -g 50 \
#   -c:a aac \
#   -f flv rtmp://a.rtmp.youtube.com/live2/46ku-tg38-umc5-wuyj-ar3b
