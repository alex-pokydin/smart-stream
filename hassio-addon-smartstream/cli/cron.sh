##write out current crontab
#crontab -l > mycron
##echo new cron into cron file
## https://crontab.guru/
##

echo "" > mycron
echo "@reboot sleep 20 && cd /home/pi/smart-stream/ && /usr/bin/npm run start-dev >> /home/pi/npm.log" >> mycron

##install new cron file
crontab mycron
rm mycron
