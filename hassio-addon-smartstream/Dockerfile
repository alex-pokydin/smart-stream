ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN \ 
    apk update && apk add --no-cache \
        nodejs \
        npm \
        ffmpeg \
        git

ADD package.json /

# Copy data for add-on
COPY run.sh /
COPY server/ /server/
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]