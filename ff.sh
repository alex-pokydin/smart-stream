#!/bin/sh

# add to cron * * * * * ff.sh IP YOUTUBE

cam_ip=$1
youtube_key=$2
ffmpeg_min_cpu=5
flag=0

ff_func() {

    echo "Start ffmpeg for $cam_ip"

    ffmpeg \
        -hide_banner \
        -stats \
        -loglevel error \
        -f lavfi \
        -i anullsrc \
        -stimeout 5000000 \
        -rtsp_transport tcp \
        -use_wallclock_as_timestamps 1 \
        -i "rtsp://$cam_ip:554/user=admin_password=tlJwpbo6_channel=1_stream=0.sdp?real_stream" \
        -t 00:30:00 \
        -c:v copy \
        -c:a aac \
        -f flv "rtmp://a.rtmp.youtube.com/live2/$youtube_key"
}


echo "Start test ffmpeg for $cam_ip"

cpu=$(ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}' | xargs -r ps -o %cpu -p | grep -v CPU)
cur_cpu=${cpu%.*}
echo "curr cpu: $cur_cpu, config: $ffmpeg_min_cpu"
diff=$(($cur_cpu - $ffmpeg_min_cpu))
echo "diff: $diff"
txt=$(echo "[cpu: $cur_cpu, config: $ffmpeg_min_cpu, diff: $diff, flag: $flag]")

if [ $diff -gt 0 ]
then
        echo "ffmpeg RUNNING! $txt"
        flag=0
else
        echo "ffmpeg stopped. killing all ffmpeg $txt"
        #if [ $flag = 1 ]
        #then
        #        killall ffmpeg
        ps -ef | grep ffmpeg | grep $cam_ip | grep -v grep | awk '{print $2}' | xargs -r kill -9
        sleep 3
        ff_func&
        #fi
        #flag=1
fi


exit 0
