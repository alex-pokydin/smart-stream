ARG BUILD_FROM=node:16
FROM $BUILD_FROM

ENV LANG C.UTF-8

ADD package.json /

# RUN npm install

# RUN \ 
#     apk add --no-cache \
#         nodejs \
#         npm

# Copy data for add-on
COPY run.sh /
COPY server/ /server/
RUN chmod a+x /run.sh

EXPOSE 3000

CMD [ "/run.sh" ]