#!/bin/sh

##pip install -U youtube-dl
##sudo apt purge youtube-dl 
#sudo pip3 install youtube-dl

screenshot_time=1
youtube_url=https://youtu.be/zZAynoPUhLs
output_file=screenshot.jpeg
output_file_old=screenshot1.jpeg

#ffmpeg -ss "$screenshot_time" -i $(youtube-dl --get-url "$youtube_url") -vframes 1 -q:v 2 "$output_file"

URL=$(youtube-dl --get-url "$youtube_url")

while true
do
  mv $output_file $output_file_old
  ffmpeg -y -i $URL -vframes 1 -q:v 2 "$output_file"
  ./compare.sh
  # ffmpeg -y -i diff.jpeg -c:v libx264 diff.mp4
  # mv -f diff.jpeg input.jpeg
  # mv -f diff.mp4 input.mp4
  sleep 10
done

exit 0



ffmpeg -f concat -safe 0 -i 'music.txt' -loop 1 -i 'image.jpg' -c:v libx264 -preset ultrafast -c:a copy -f flv rtmp://rtmp.youtube.com/live/stream
