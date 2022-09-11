#!/bin/sh

##pip install -U youtube-dl
##sudo apt purge youtube-dl 
#sudo pip3 install youtube-dl

screenshot_time=1
youtube_url=https://youtu.be/zZAynoPUhLs
output_file=screenshot.jpeg
output_file_old=screenshot1.jpeg

#highlight-style
#assign, threshold, tint, xor

#-metric MAE, MSE, PAE, PSNR, RMSE

#-type Bilevel, Grayscale, Palette, PaletteMatte, TrueColor, TrueColorMatte, ColorSeparation, ColorSeparationMatte, Optimize

# while true
# do
  gm compare -highlight-style tint -highlight-color black -file diff.jpeg $output_file $output_file_old
#   sleep 10
# done

exit 0

