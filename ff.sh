#!/bin/sh

# streams.txt
# "IP" "YOUTUBE" "RTSP"

#exit 0

ffmpeg_min_cpu=6
ffmpeg_max_cpu=30
flag=0

log_func() {
        log_msg=$(echo "[$cam_ip] $1")
        echo $log_msg
        logger -t "STREAM" $log_msg
}

if [ "$#" -eq 0 ]
then
    file="$(dirname $0)/streams.txt"
    logger -t "STREAM" "Reading streams from: ${file}"

    while IFS='' read -r LinefromFile || [[ -n "${LinefromFile}" ]]; do
      logger -t "STREAM" "Check: ${LinefromFile}"
      set $LinefromFile
      ffpid=$(ps -ef | grep ffmpeg | grep $1 | grep -v grep | awk '{print $2}')
      logger -t "STREAM" "PID = $ffpid"
      
      if test -z "$ffpid"
      then
        logger -t "STREAM" "ffmpeg starting: $0 ${LinefromFile}"
        eval "$0 ${LinefromFile}" &>/dev/null & disown;
      else
        cpu=$(ps -o %cpu -p $ffpid| grep -v CPU)
        cur_cpu=${cpu%.*}
        txt=$(echo "[pid: $ffpid, cpu: $cur_cpu ( min: $ffmpeg_min_cpu, max: $ffmpeg_max_cpu )]")
        logger -t "STREAM" "ffmpeg running... $txt"
        if [ $cur_cpu -lt $ffmpeg_min_cpu ] || [ $cur_cpu -gt $ffmpeg_max_cpu ]
        then
            logger -t "STREAM" "ffmpeg PROBLEM!"
            ps -ef | grep ffmpeg | grep $1 | grep -v grep | awk '{print $2}' | xargs -r kill -9
            #sleep 3
            #eval "$0 ${LinefromFile}" &>/dev/null & disown;
        fi
      fi
    done < "$file"

    exit 0
fi


cam_ip=$1
youtube_key=$2


rtsp=$(echo "rtsp://$cam_ip:554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream")
if [ "$#" -eq 3 ]
then
    rtsp=$(echo $3)
fi


ff_func() {

    ps -ef | grep ffmpeg | grep $1 | grep -v grep | awk '{print $2}' | xargs -r kill -9
    log_func "Start ffmpeg: $rtsp, $youtube_key"

#        -hide_banner \
#        -stats \
#        -loglevel error \
#        -stimeout 5000000 \

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

    sleep 3
}

while true
do

log_func "Start test ffmpeg"

ffpid=$(ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}')
cpu=$(ps -o %cpu -p $ffpid| grep -v CPU)
cur_cpu=${cpu%.*}
#log_func "curr cpu: $cur_cpu, config: $ffmpeg_min_cpu"
#diff=$(($cur_cpu - $ffmpeg_min_cpu))
#log_func "diff: $diff"
txt=$(echo "[pid: $ffpid, cpu: $cur_cpu, min: $ffmpeg_min_cpu, max: $ffmpeg_max_cpu]")

#if [ $cur_cpu -gt $ffmpeg_min_cpu ] && [ $cur_cpu -lt $ffmpeg_max_cpu ]
#then
#        log_func "ffmpeg RUNNING! $txt"
#        flag=0
#else
#        log_func "ffmpeg PROBLEM! $txt"
#        ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}' | xargs -r kill -9
#        sleep 3
        ff_func
#fi

done

exit 0
