# Start dev
```
npm run dev
```

# install global

```
sudo npm i -g nodemon
sudo npm i -g forever
sudo npm i -g forever-service

```

# Install mongoDB on orange pi
https://github.com/robertsLando/MongoDB-OrangePI

Create mongodb user and folders needed

```bash
sudo adduser --ingroup nogroup --shell /etc/false --disabled-password --gecos "" \
--no-create-home mongodb

sudo mkdir /var/log/mongodb
sudo chown mongodb:nogroup /var/log/mongodb

sudo mkdir /var/lib/mongodb
sudo chown mongodb:root /var/lib/mongodb
sudo chmod 775 /var/lib/mongodb
```

Clone this repo and copy binaries files, configuration and service

```bash
git clone https://github.com/robertsLando/MongoDB-OrangePI.git

cd MongoDB-OrangePI
sudo cp mongodb.conf /etc
sudo cp mongodb.service /lib/systemd/system

cd bin
sudo chown root:root mongo*
sudo chmod 755 mongo*
sudo cp -p mongo* /usr/bin

sudo systemctl start mongodb
sudo systemctl status mongodb
```

Enable mongodb on startup

```bash
sudo systemctl enable mongodb

```



# install ffmpeg on WIN
download and uzip ffmpeg from official site
https://github.com/adaptlearning/adapt_authoring/wiki/Installing-FFmpeg
```
setx /M PATH "path\to\ffmpeg\bin;%PATH%"
```
do not forget to restart console and/or IDE

