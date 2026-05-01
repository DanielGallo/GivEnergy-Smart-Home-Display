ARG BUILD_FROM
FROM $BUILD_FROM

# Install nginx and jq (jq is used in the init script to parse add-on options)
RUN apk add --no-cache nginx jq netcat-openbsd

# Copy the web app files.
# Run scripts/prepare-addon.sh from the repo root before building to populate www/.
COPY www/ /var/www/html/

# Copy rootfs (nginx config, init script)
COPY rootfs/ /

RUN chmod a+x /etc/cont-init.d/50-generate-config.sh

EXPOSE 8099
CMD ["nginx", "-g", "daemon off;"]
