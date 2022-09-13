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
    }

    /**
     * Fetch the initial set of data and setup a routine to fetch the data every 10 seconds
     */
    launch() {
        const me = this;

        // Get the initial set of data
        me.fetchData();

        // Repopulate the data every 10 seconds
        setInterval(me.fetchData.bind(me), 10000);
    }

    /**
     * Fetch the latest values from GivTCP
     */
    fetchData() {
        const me = this;

        fetch(`http://${me.givTcpHostname}/readData`, {
            mode: 'cors',
            headers: {
                'Access-Control-Allow-Origin': 'localhost:63342'
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

        me.updateTimeStamp(data);

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
            let offsetY = 130;
            let offsetAddition = 85;
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

    /**
     * Updates the time in the UI to let the user know when the data was last refreshed by GivTCP
     */
    updateTimeStamp(data) {
        if (data && data['Last_Updated_Time']) {
            const clock = $('#clock');
            const dateUpdated = new Date(data['Last_Updated_Time']);
            const dateDiff = (new Date() - dateUpdated) / 1000;

            let hours = dateUpdated.getHours();
            let minutes = dateUpdated.getMinutes();
            let suffix = hours >= 12 ? 'pm' : 'am';

            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;

            clock.text(`${hours}:${minutes}${suffix}`);

            // If the inverter data is older than 3 minutes, add a red border to the clock to illustrate a possible issue
            if (dateDiff > 180) {
                clock.addClass('overdue');
            } else {
                clock.removeClass('overdue');
            }
        }
    }
}

export { App };
window.App = new App();