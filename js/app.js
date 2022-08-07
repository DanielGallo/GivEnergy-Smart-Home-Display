import { SensorType } from './enums.js';
import { Sensors } from './sensors.js';
import { Formatters } from './formatters.js';

class App {
    constructor() {
        const me = this;

        me.homeAssistantApiKey = null;
        me.homeAssistantBaseDomain = null;

        // Fetch the Home Assistant access token and base URL from `app.json`
        fetch("./app.json")
            .then(response => {
                return response.json();
            })
            .then(data => {
                me.homeAssistantAccessToken = data.homeAssistantAccessToken;
                me.homeAssistantBaseDomain = data.homeAssistantBaseDomain;

                if (me.homeAssistantAccessToken != null && me.homeAssistantBaseDomain != null) {
                    me.launch();
                }
            });
    }

    /**
     * Establish the WebSocket connection to Home Assistant
     */
    launch() {
        const me = this;

        me.webSocket = new WebSocket(`ws://${me.homeAssistantBaseDomain}/api/websocket`);
        me.webSocket.onopen = () => this.onWebSocketOpen();
        me.webSocket.onclose = () => this.onWebSocketClose();
        me.webSocket.onmessage = (event) => this.onWebSocketMessage(event);

        me.cache = {};
    }

    /**
     * Once the WebSocket connection is open, authenticate with Home Assistant
     */
    onWebSocketOpen() {
        const me = this;

        me.webSocket.send(JSON.stringify({
            type: 'auth',
            access_token: me.homeAssistantAccessToken
        }));
    }

    onWebSocketClose() {
        console.log('Connection closed');
    }

    /**
     * Respond to incoming messages (data) from Home Assistant
     * @param event
     */
    onWebSocketMessage(event) {
        const me = this;
        let data = JSON.parse(event.data);

        if (data.type === 'auth_ok') {
            // Authentication was successful, so get the initial states of sensor values and summary data, so that
            // we have data to show in the user interface when the app first renders
            me.webSocket.send(JSON.stringify({
                id: 10,
                type: 'get_states'
            }));

            // And subscribe to any sensor changes
            me.webSocket.send(JSON.stringify({
                id: 11,
                type: 'subscribe_events',
                event_type: 'state_changed'
            }));
        } else if (data.type === 'result' && data.result) {
            // Loop through the initial set of values - these are shown when the page first loads
            for (let i = 0; i < data.result.length; i ++) {
                let item = data.result[i];

                me.processItem(item);
            }

            me.updateTimeStamp();
        } else if (data.type === 'event') {
            // Then update the UI as individual data updates come in from Home Assistant
            let sensorData = data.event.data.new_state;

            me.processItem(sensorData);
            me.updateTimeStamp();
        }
    }

    /**
     * This takes an individual sensor data object and based on its type (power usage, power flow, summary), and
     * renders it within the appropriate point in the user interface
     * @param sensorData An individual sensor data object
     */
    processItem(sensorData) {
        const me = this;
        const entityId = sensorData.entity_id.substring(sensorData.entity_id.indexOf('.') + 1);

        // If the data update from Home Assistant is one we're interested in (i.e. it exists in `sensors.js`)
        if (Sensors.some(e => e.id === entityId)) {
            const sensor = Sensors.filter(e => e.id === entityId)[0];   // Lookup the sensor info, defined in `sensors.js`
            let value = null;
            let element = null;

            // Store a cache of the latest sensor values, and when they were last changed
            me.cache[entityId] = {
                value: sensorData.state,
                modified: new Date(sensorData.last_changed)
            };

            let cachedSensor = me.cache[entityId];

            if (sensor.type === SensorType.Summary) {
                element = $(`#${sensor.textElementId}`);
                value = cachedSensor.value;
            } else if (sensor.type === SensorType.Power) {
                element = $(`#${sensor.textElementId}`);

                let inverseSensorCache = me.cache[sensor.inverse];

                // If it's a value that will be shown in a circle, figure out which value to show - there might
                // be an inverse value that is more recent (e.g. import vs. export)
                if (inverseSensorCache && inverseSensorCache.modified > cachedSensor.modified) {
                    value = inverseSensorCache.value;
                } else {
                    value = cachedSensor.value;
                }
            } else if (sensor.type === SensorType.Flow) {
                element = $(`#${sensor.flowElementId}`);
                value = cachedSensor.value;

                if (value > 0 && sensor.nonZeroValueCheck) {
                    // Check if the dependent sensor (if defined) has a value, and whether the dependent sensor
                    // has an inverse sensor. If so, check which of those sensor values is newer.
                    let dependentSensor = me.cache[sensor.nonZeroValueCheck];
                    let inverseSensor = Sensors.filter(e => e.id === sensor.nonZeroValueCheck)[0].inverse;

                    if (inverseSensor) {
                        let inverseDependentSensor = me.cache[inverseSensor];

                        if (dependentSensor.modified > inverseDependentSensor.modified) {
                            value = dependentSensor.value;
                        } else {
                            value = inverseDependentSensor.value;
                        }
                    }
                }
            }

            let group = null;
            let line = null;
            let arrow = null;

            if (sensor.type === SensorType.Flow) {
                group = element;

                if (group.children('path').length > 0) {
                    // Arc flow
                    arrow = 'arc-arrow';

                    if (entityId === 'givtcp_grid_to_battery' || entityId === 'givtcp_solar_to_grid') {
                        arrow = 'arc-arrow-opposite';
                    }

                    line = group.children('path')[0];
                } else {
                    // Line flow
                    arrow = 'line-arrow';
                    line = group.children('line')[0];
                }
            } else if (sensor.type === SensorType.Power) {
                arrow = 'line-arrow';
                group = element.parent().parent();
                element.text(Formatters.sensorValue(value, sensor));

                if (group.children('line').length > 0) {
                    line = group.children('line')[0];
                }
            } else if (sensor.type === SensorType.Summary) {
                element.text(Formatters.sensorValue(value, sensor));
            }

            if (sensor.type === SensorType.Power || sensor.type === SensorType.Flow) {
                if (parseFloat(value) < 0.01) {
                    // If value is less than 0.01 kW, mark the line/group as Idle
                    if (line) {
                        line.setAttribute("marker-end", "");
                    }

                    group.removeClass('active');
                    group.addClass('idle');
                } else {
                    // Active
                    if (line) {
                        line.setAttribute("marker-end", `url(#${arrow})`);
                    }

                    group.removeClass('idle');
                    group.addClass('active');
                }
            }
        }
    }

    /**
     * Updates the time in the UI to let the user know when the data was last refreshed
     */
    updateTimeStamp() {
        const clock = $('#clock');
        const date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();

        if (minutes < 10) {
            minutes = '0' + minutes;
        }

        let suffix = 'am';

        if (hours > 12) {
            hours -= 12;
            suffix = 'pm';
        } else if (hours === 0) {
            hours = 12;
        }

        clock.text(`${hours}:${minutes}${suffix}`);
    }
}

export { App };
window.App = new App();