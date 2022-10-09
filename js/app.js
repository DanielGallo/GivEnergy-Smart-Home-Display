import { SensorType, Suffix } from './enums.js';
import { Sensors } from './sensors.js';
import { Helpers } from './helpers.js';
import { Formatters } from './formatters.js';
import { Converters } from './converters.js';

class App {
    constructor() {
        const me = this;

        me.givTcpHostname = null;
        me.solarRate = null;
        me.exportRate = null;
        me.cachedData = null;
        me.rendered = false;

        // Fetch the settings from `app.json`
        fetch("./app.json")
            .then(response => {
                return response.json();
            })
            .then(data => {
                me.givTcpHostname = data.givTcpHostname;
                me.solarRate = data.solarRate;
                me.exportRate = data.exportRate;

                if (me.givTcpHostname != null && me.solarRate != null && me.exportRate != null) {
                    me.launch();
                }
            });

        // When the window is resized, check whether the layout needs switching between portrait and landscape mode
        window.addEventListener('resize', me.resizeCanvas.bind(me), true);

        // Do an initial layout check when first loading
        me.resizeCanvas();
    }

    /**
     * Fetch the initial set of data and setup a routine to fetch the data every 10 seconds
     */
    launch() {
        const me = this;

        // Get the initial set of data
        me.fetchData();

        // Fetch the data from GivTCP every 8 seconds
        setInterval(me.fetchData.bind(me), 8000);
    }

    /**
     * Fetch the latest values from GivTCP
     */
    fetchData() {
        const me = this;

        fetch(`http://${me.givTcpHostname}/readData`, {
            mode: 'cors',
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        }).then(response => {
            return response.json();
        }).then(data => {
            me.onResponse(data)
        });
    }

    /**
     * Successful response from GivTCP
     * @param data
     */
    onResponse(data) {
        const me = this;

        me.cachedData = data;

        me.updateRefreshIntervalText();
        setInterval(me.updateRefreshIntervalText.bind(me), 1000);

        for (let i in Sensors) {
            let sensor = Sensors[i];
            let value = null;

            if (sensor.mapping) {
                value = Helpers.getPropertyValueFromMapping(data, sensor.mapping);
            }

            // Some sensors require calculation of the values
            if (sensor.id === 'Battery_State') {
                let chargeRate = data.Power.Power.Charge_Power;
                let dischargeRate = data.Power.Power.Discharge_Power;

                if (dischargeRate > 0) {
                    value = "Discharging";
                } else if (chargeRate > 0) {
                    value = "Charging";
                } else {
                    value = "Idle";
                }
            } else if (sensor.id === 'Solar_Income' || sensor.id === 'Export_Income') {
                let income = value * me.solarRate;

                value = Converters.numberToCurrency(income);
            }

            // Process the sensor if there's a value and it's non-zero,
            // or process the sensor if forced (e.g. to reset the daily usage stats to zero at midnight)
            if (value || sensor.forceRefresh) {
                me.processItem({
                    sensor: sensor,
                    value: value
                });
            }
        }
    }

    /**
     * This takes an individual sensor data object and based on its type (power usage, power flow, summary), and
     * renders it within the appropriate point in the user interface
     * @param sensorData An individual sensor data object
     */
    processItem(sensorData) {
        const me = this;
        const entityId = sensorData.sensor.id;
        const sensor = sensorData.sensor;

        let value = sensorData.value;
        let element = null;
        let group = null;
        let line = null;
        let arrow = null;

        if ((sensor.type === SensorType.Summary || sensor.type === SensorType.Power) && sensor.textElementId) {
            element = $(`#${sensor.textElementId}`);
        } else if (sensor.type === SensorType.Flow) {
            element = $(`#${sensor.flowElementId}`);
        }

        if (sensor.type === SensorType.Power || sensor.type === SensorType.Flow) {
            // If value is negative, convert to positive (e.g. export vs. import, discharge vs. charge)
            if (value < 0) {
                value = value * -1;
            }

            // If power or flow values are less than 10 Watts (less than 0.01 kW), treat as a zero-value
            if (value < 10) {
                value = 0;
            }
        }

        if (sensor.type === SensorType.Flow) {
            group = element;

            if (group.children('path').length > 0) {
                // Arc flow
                arrow = 'arc-arrow';

                if (entityId === 'Grid_to_Battery' || entityId === 'Solar_to_Grid') {
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
        } else if (sensor.type === SensorType.Summary && sensor.id === 'Battery_Statistics') {
            let batteries = value;
            let svgContainerElement = $('#inverter_panel')[0];
            let svgCloneableElement = $('#batteryDetails')[0];
            let offsetY = 102;
            let offsetAddition = 100;
            let i = 0;

            // On first load, render the battery statistics panels
            if (!me.rendered) {
                // The number of batteries can vary, so iterate over each battery
                for (let battery in batteries) {
                    let svgClonedElement = svgCloneableElement.cloneNode(true);
                    svgClonedElement.setAttribute('transform', `translate(0, ${offsetY})`);
                    svgClonedElement.setAttribute('style', '');
                    svgClonedElement.setAttribute('id', `battery_${battery}`);

                    svgContainerElement.appendChild(svgClonedElement);

                    let batteryNameEl = $(`#battery_${battery} > text.label`);
                    batteryNameEl.text(`Battery ${++i}`);

                    offsetY = offsetY + offsetAddition;
                }

                me.rendered = true;
            }

            // Now populate or update the values being shown in the battery statistics panels
            for (let battery in batteries) {
                let batteryData = batteries[battery];

                // Calculate the remaining capacity (in kWh) of the battery
                let remainingAh = batteryData['Battery_Remaining_Capacity'];
                let batteryVoltage = batteryData['Battery_Voltage'];
                let remainingKWh = (remainingAh * batteryVoltage) / 1000;

                let stateOfChargeEl = $(`#battery_${battery} >> tspan.state_of_charge`);
                stateOfChargeEl.text(Formatters.sensorValue(batteryData['Battery_SOC'], {
                    suffix: Suffix.Percent
                }));

                let remainingCapacityEl = $(`#battery_${battery} >> tspan.remaining_capacity`);
                remainingCapacityEl.text(Formatters.sensorValue(remainingKWh, {
                    suffix: Suffix.Energy,
                    formatter: Formatters.roundToOneDecimalPlace
                }));

                let temperatureEl = $(`#battery_${battery} >> tspan.temperature`);
                temperatureEl.text(Formatters.sensorValue(batteryData['Battery_Temperature'], {
                    suffix: Suffix.Temperature,
                    formatter: Formatters.roundToOneDecimalPlace
                }));
            }
        } else if (sensor.type === SensorType.Summary) {
            element.text(Formatters.sensorValue(value, sensor));
        }

        if (sensor.type === SensorType.Power || sensor.type === SensorType.Flow) {
            if (value === 0) {
                // If value is less than 0.01 kW (10 Watts), mark the line/group as Idle
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

    resizeCanvas() {
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let canvas = $('#canvas')[0];

        if (width > height) {
            // Landscape mode
            canvas.setAttribute('viewBox', '0 0 840 365');
            $('#diagram')[0].setAttribute('transform', '');
            $('#panels')[0].setAttribute('transform', '');
        } else {
            // Portrait mode
            canvas.setAttribute('viewBox', '0 0 500 840');
            $('#diagram')[0].setAttribute('transform', 'translate(16, 0), scale(1.3)');
            $('#panels')[0].setAttribute('transform', 'translate(-392, 470), scale(1.07)');
        }
    }

    /**
     * Updates the actual time in the UI
     */
    updateTime() {
        const clock = $('#clock');
        const date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let suffix = hours >= 12 ? 'pm' : 'am';

        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;

        clock.text(`${hours}:${minutes}${suffix}`);
    }

    /**
     * Updates the elapsed time in the UI to let the user know when the data was last refreshed by GivTCP
     */
    updateRefreshIntervalText() {
        const me = this;

        //me.updateTime();

        if (me.cachedData && me.cachedData['Last_Updated_Time']) {
            const refreshIntervalText = $('#refreshIntervalText');
            const dateUpdated = new Date(me.cachedData['Last_Updated_Time']);
            const seconds = Math.round((new Date() - dateUpdated) / 1000);
            const secondsText = Formatters.renderLargeNumber(seconds < 0 ? 0 : seconds);
            const suffix = seconds === 1 ? '': 's';

            refreshIntervalText.text(`Inverter data last updated ${secondsText} second${suffix} ago`);
        }
    }
}

export { App };
window.App = new App();