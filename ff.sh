#!/bin/sh

# streams.txt
# "IP" "YOUTUBE" "RTSP"

#exit 0

ffmpeg_min_cpu=6
ffmpeg_max_cpu=30
flag=0

SYSLOG() {
  echo $1
  logger -t "STREAM" $1
}

log_func() {
    SYSLOG "[$cam_ip] $1"
}

if [ "$#" -eq 0 ]
then
    file="$(dirname $0)/streams.txt"
    SYSLOG "Reading streams from: ${file}"

    while IFS='' read -r LinefromFile || [[ -n "${LinefromFile}" ]]; do
      SYSLOG "Check: ${LinefromFile}"
      set $LinefromFile
      
      # check ffmpeg instance count
      count=$(pgrep -fc "ffmpeg.*$1.*$2")
      if [ $count -gt 1 ]
      then
        killed=$(pkill -fc "$1.*$2")
        SYSLOG "Too much processes, killed: $killed"
      fi

      # check if ffmpeg is running
      pid=$(pgrep -f "ffmpeg.*$1.*$2")
      SYSLOG "PID = $pid"
      if test -z "$pid"
      then
        SYSLOG "ffmpeg starting: $0 ${LinefromFile}"
        eval "$0 ${LinefromFile}> /dev/null 2>&1 < /dev/null &"
      else
        cpu=$(ps -o %cpu -p $pid| grep -v CPU)
        cur_cpu=${cpu%.*}
        txt=$(echo "[pid: $pid, cpu: $cur_cpu ( min: $ffmpeg_min_cpu, max: $ffmpeg_max_cpu )]")
        SYSLOG "ffmpeg running... $txt"
        if [ $cur_cpu -lt $ffmpeg_min_cpu ] || [ $cur_cpu -gt $ffmpeg_max_cpu ]
        then
            killed=$(pkill -fc "ffmpeg.*$1.*$2")
            SYSLOG "ffmpeg PROBLEM! killed: $killed"
        fi
      fi
    done < "$file"

    exit 0
fi

# starting ffmpeg loop
cam_ip=$1
youtube_key=$2
rtsp=$(echo "rtsp://$cam_ip:554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream")
if [ "$#" -eq 3 ]
then
    rtsp=$(echo $3)
fi

while true
do
  killed=$(pkill -fc "ffmpeg.*$1.*$2")
  log_func "Killing ffmpeg instances! killed: $killed"
  log_func "Start ffmpeg: $rtsp, $youtube_key"

  ffmpeg \
      -rtsp_transport tcp \
      -fflags +genpts \
      -re \
      -i "$rtsp" \
      -f lavfi \
      -i anullsrc \
      -use_wallclock_as_timestamps 1 \
      -c:v copy \
      -c:a aac \
      -threads 1 \
      -f flv "rtmp://a.rtmp.youtube.com/live2/$youtube_key"
  
  sleep 1
done

exit 0
