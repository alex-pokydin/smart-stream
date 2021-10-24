#!/bin/sh

# streams.txt
# "IP" "YOUTUBE" "RTSP"

if [ "$#" -eq 0 ]
then
    file="$(dirname $0)/streams.txt"
    logger -t "STREAM" "Reading streams from: ${file}"

    while IFS='' read -r LinefromFile || [[ -n "${LinefromFile}" ]]; do
      logger -t "STREAM" "Check: ${LinefromFile}"
      eval "$0 ${LinefromFile}"
      sleep 2
    done < "$file"

    exit 0
fi


cam_ip=$1
youtube_key=$2
ffmpeg_min_cpu=10
ffmpeg_max_cpu=30
flag=0

rtsp=$(echo "rtsp://$cam_ip:554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream")
if [ "$#" -eq 3 ]
then
    rtsp=$(echo $3)
fi


log_func() {
        log_msg=$(echo "[$cam_ip] $1")
        echo $log_msg
        logger -t "STREAM" $log_msg
}

ff_func() {

    log_func "Start ffmpeg"

#        -hide_banner \
#        -stats \
#        -loglevel error \
#        -stimeout 5000000 \

    ffmpeg \
        -rtsp_transport tcp \
        -i "$rtsp" \
        -f lavfi \
        -i anullsrc \
        -use_wallclock_as_timestamps 1 \
        -c:v copy \
        -c:a aac \
        -f flv -t 00:09:55 "rtmp://a.rtmp.youtube.com/live2/$youtube_key"

    sleep 3
}


log_func "Start test ffmpeg"

ffpid=$(ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}')
cpu=$(ps -o %cpu -p $ffpid| grep -v CPU)
cur_cpu=${cpu%.*}
#log_func "curr cpu: $cur_cpu, config: $ffmpeg_min_cpu"
#diff=$(($cur_cpu - $ffmpeg_min_cpu))
#log_func "diff: $diff"
txt=$(echo "[pid: $ffpid, cpu: $cur_cpu, min: $ffmpeg_min_cpu, max: $ffmpeg_max_cpu]")

if [ $cur_cpu -gt $ffmpeg_min_cpu ] && [ $cur_cpu -lt $ffmpeg_max_cpu ]
then
        log_func "ffmpeg RUNNING! $txt"
        flag=0
else
        log_func "ffmpeg PROBLEM! $txt"
        ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}' | xargs -r kill -9
        sleep 3
        ff_func&
fi


exit 0
