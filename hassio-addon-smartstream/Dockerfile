ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

COPY package.json /

RUN \ 
    apk update \
    && apk add --no-cache \
        nodejs \
        npm \
        ffmpeg \
        git \
        nano \
    && npm install \
        --no-audit \
        --no-fund \
        --no-update-notifier \
        --omit=dev \
        --unsafe-perm \
    \
    && npm cache clear --force
# Copy data for add-on
COPY run.sh /
COPY server/ /server/
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]