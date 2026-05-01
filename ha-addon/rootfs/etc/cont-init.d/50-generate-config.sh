#!/usr/bin/with-contenv bashio

HOST=$(bashio::config 'givtcp_host')
START_PORT=6345
MAX_INVERTERS=8

bashio::log.info "Auto-detecting GivTCP instances at ${HOST} from port ${START_PORT}..."

PROXY_BLOCKS=""
HOSTS_JSON="["
FIRST=true
INDEX=0

for i in $(seq 0 $((MAX_INVERTERS - 1))); do
    PORT=$((START_PORT + i))

    if nc -z -w 2 "$HOST" "$PORT" 2>/dev/null; then
        PROXY_PATH="/proxy/${INDEX}"
        NAME="Inverter $((INDEX + 1))"

        PROXY_BLOCKS="${PROXY_BLOCKS}
    location ${PROXY_PATH}/ {
        proxy_pass http://${HOST}:${PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 10s;
    }
"
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            HOSTS_JSON="${HOSTS_JSON},"
        fi
        HOSTS_JSON="${HOSTS_JSON}{\"name\":\"${NAME}\",\"proxyPath\":\"${PROXY_PATH}\"}"

        bashio::log.info "  Found ${NAME} at ${HOST}:${PORT}"
        INDEX=$((INDEX + 1))
    else
        bashio::log.info "  No instance at port ${PORT}, stopping."
        break
    fi
done

HOSTS_JSON="${HOSTS_JSON}]"

if [ "$INDEX" -eq 0 ]; then
    bashio::log.warning "No GivTCP instances found at ${HOST}. Check the host setting and that GivTCP is running."
fi

echo "${PROXY_BLOCKS}" > /etc/nginx/conf.d/proxy.conf
echo "{\"givTcpHosts\":${HOSTS_JSON}}" > /var/www/html/app.json

bashio::log.info "Done: ${INDEX} GivTCP instance(s) configured."
