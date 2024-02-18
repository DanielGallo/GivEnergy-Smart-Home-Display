import { CombinatorType, SensorType, Suffix } from './enums.js';
import { Sensors } from './sensors.js';
import { Helpers } from './helpers.js';
import { Formatters } from './formatters.js';
import { Converters } from './converters.js';

class App {
    constructor() {
        const me = this;

        me.givTcpHosts = null;
        me.solarRate = null;
        me.exportRate = null;
        me.processedData = null;
        me.rendered = false;

        // Fetch the settings from `app.json`
        fetch('./app.json')
            .then(response => {
                return response.json();
            })
            .then(data => {
                me.givTcpHosts = data.givTcpHosts;
                me.solarRate = data.solarRate;
                me.exportRate = data.exportRate;

                if (me.givTcpHosts != null && me.solarRate != null && me.exportRate != null) {
                    me.givTcpHosts.forEach((givTcpHost, index) => {
                        givTcpHost.sortOrder = index;
                    });

                    me.launch();
                }
            });

        // When the window is resized, check whether the layout needs switching between portrait and landscape mode
        window.addEventListener('resize', me.resizeCanvas.bind(me), true);

        // Do an initial layout check when first loading
        me.resizeCanvas();
    }

    /**
     * Fetch the initial set of data and set up a routine to fetch the data every 10 seconds
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
        me.cachedData = [];

        // Generate URL to GivTCP based on current URL of web app
        let baseUrl = window.location.protocol + '//' + window.location.hostname;

        // But also allow the GivTCP hostname to be passed in as a "hostname" query string param
        const urlParams = new URLSearchParams(window.location.search);
        const hostname = urlParams.get('hostname');

        // If the hostname has been overridden, use it
        if (hostname) {
            baseUrl = window.location.protocol + '//' + hostname;
        }

        let fetchPromises = me.givTcpHosts.map((givTcpHost) => {
            return fetch(`${baseUrl}:${givTcpHost.port}/readData`, {
                mode: 'cors',
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            }).then(response => {
                return response.json();
            }).then(data => {
                me.cachedData.push({
                    name: givTcpHost.name,
                    sortOrder: givTcpHost.sortOrder,
                    data: data
                });
            });
        });

        Promise.all(fetchPromises).then(() => {
            me.cachedData.sort((a, b) => a.sortOrder - b.sortOrder);

            me.onResponse();
        });
    }

    /**
     * Successful response from GivTCP
     */
    onResponse() {
        const me = this;

        me.updateRefreshIntervalText();
        setInterval(me.updateRefreshIntervalText.bind(me), 1000);

        me.processedData = {};

        Sensors.forEach((sensor) => {
            let value = null;

            if (sensor.combinator === CombinatorType.Addition) {
                value = 0;

                me.cachedData.forEach((cachedRecord) => {
                    value += Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping);
                });
            } else if (sensor.combinator === CombinatorType.Any) {
                value = Helpers.getPropertyValueFromMapping(me.cachedData[0].data, sensor.mapping);
            } else if (sensor.combinator === CombinatorType.Average) {
                let numbers = [];

                me.cachedData.forEach((cachedRecord) => {
                    numbers.push(Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping));
                });

                let sum = numbers.reduce((a, b) => a + b, 0);
                value = sum / numbers.length;
            } else if (sensor.combinator === CombinatorType.EarliestDate) {
                let dates = [];

                me.cachedData.forEach((cachedRecord) => {
                    dates.push(new Date(Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping)));
                });

                value = new Date(Math.min.apply(null, dates));
            }

            me.processedData[sensor.id] = value;
        });

        const data = me.processedData;

        Sensors.forEach((sensor) => {
            let value = me.processedData[sensor.id];

            // Some sensors require calculation of the values
            if (sensor.id === 'Battery_State') {
                let chargeRate = data.Charge_Power;
                let dischargeRate = data.Discharge_Power;

                if (dischargeRate > 0) {
                    value = 'Discharging';
                } else if (chargeRate > 0) {
                    value = 'Charging';
                } else {
                    value = 'Idle';
                }
            } else if (sensor.id === 'Load_Power') {
                let loadPower = data.Discharge_Power + data.PV_Power + data.Grid_Power + data.Charge_Power;

                value = loadPower;
            } else if (sensor.id === 'Solar_Income') {
                let income = value * me.solarRate;

                value = Converters.numberToCurrency(income);
            } else if (sensor.id === 'Export_Income') {
                let income = value * me.exportRate;

                value = Converters.numberToCurrency(income);
            } else if (sensor.id === 'Inverter_Details') {
                let inverters = [];

                me.cachedData.forEach((cachedRecord) => {
                    let inverterBatteries = Helpers.getPropertyValueFromMapping(cachedRecord.data, 'Battery_Details');

                    let batteryArray = Object.keys(inverterBatteries).map(function(key) {
                        return inverterBatteries[key];
                    });

                    inverters.push({
                        name: cachedRecord.name,
                        data: data,
                        rawData: cachedRecord.data,
                        batteries: batteryArray
                    });
                });

                value = inverters;
            }

            // Process the sensor if there's a value and it's non-zero,
            // or process the sensor if forced (e.g. to reset the daily usage stats to zero at midnight)
            if (value || sensor.forceRefresh) {
                me.processItem({
                    sensor: sensor,
                    value: value
                });
            }
        });
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
        } else if (sensor.type === SensorType.Summary && sensor.id === 'Inverter_Details') {
            let inverters = value;
            let svgContainerElement = $('#inverter_panel')[0];
            let svgCloneableInverterElement = $('#inverterDetails')[0];
            let svgCloneableBatteryElement = $('#batteryDetails')[0];
            let offsetY = 3;
            let inverterOffsetAddition = 112;
            let batteryOffsetAddition = 18;
            let spacer = 16;
            let inverterIndex = -1;

            // On first load, render the battery statistics panels
            if (!me.rendered) {
                inverters.forEach(inverter => {
                    let batteryIndex = -1;
                    let svgClonedElement = svgCloneableInverterElement.cloneNode(true);
                    svgClonedElement.setAttribute('transform', `translate(0, ${offsetY})`);
                    svgClonedElement.setAttribute('style', '');
                    svgClonedElement.setAttribute('id', `inverter_${++ inverterIndex}`);

                    svgContainerElement.appendChild(svgClonedElement);

                    let inverterNameEl = $(`#inverter_${inverterIndex} > text.label`);
                    inverterNameEl.text(`Inverter (${inverter.name})`);

                    offsetY = offsetY + inverterOffsetAddition;

                    // The number of batteries can vary, so iterate over each battery
                    for (let battery in inverter.batteries) {
                        let svgClonedElement = svgCloneableBatteryElement.cloneNode(true);
                        svgClonedElement.setAttribute('transform', `translate(0, ${offsetY})`);
                        svgClonedElement.setAttribute('style', '');
                        svgClonedElement.setAttribute('id', `battery_${inverterIndex}_${++ batteryIndex}`);

                        svgContainerElement.appendChild(svgClonedElement);

                        offsetY = offsetY + batteryOffsetAddition;
                    }

                    offsetY = offsetY + spacer;
                })

                me.rendered = true;
            }

            inverterIndex = -1;

            // Now populate or update the values being shown in the inverter and battery statistics panels
            inverters.forEach(inverter => {
                inverterIndex ++;
                let batteries = inverter.batteries;
                let batteryIndex = -1;

                let solarPowerEl = $(`#inverter_${inverterIndex} >> tspan.solar_power`);
                solarPowerEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.PV_Power'), {
                    converter: Converters.wattsToKw,
                    suffix: Suffix.Power
                }));

                let powerReserveEl = $(`#inverter_${inverterIndex} >> tspan.power_reserve`);
                powerReserveEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Control.Battery_Power_Reserve'), {
                    suffix: Suffix.Percent
                }));

                let targetChargeEl = $(`#inverter_${inverterIndex} >> tspan.target_soc`);
                targetChargeEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Control.Target_SOC'), {
                    suffix: Suffix.Percent
                }));

                let temperatureEl = $(`#inverter_${inverterIndex} >> tspan.inverter_temperature`);
                temperatureEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Invertor_Details.Invertor_Temperature'), {
                    suffix: Suffix.Temperature,
                    formatter: Formatters.roundToWholeNumber
                }))

                let inverterStatusText = '';
                let inverterStatusValue = '';
                let inverterRate = null;
                let chargeRate = Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.Charge_Power');
                let dischargeRate = Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.Discharge_Power');

                if (dischargeRate > 0) {
                    inverterStatusText = 'Batteries Discharging';
                    inverterRate = dischargeRate;
                } else if (chargeRate > 0) {
                    inverterStatusText = 'Batteries Charging';
                    inverterRate = chargeRate;
                } else {
                    inverterStatusText = 'Batteries Idle';
                }

                if (inverterRate != null) {
                    inverterStatusValue = Formatters.sensorValue(inverterRate, {
                        converter: Converters.wattsToKw,
                        suffix: Suffix.Power
                    });
                }

                let inverterStatusTextEl = $(`#inverter_${inverterIndex} >> tspan.inverter_status_text`);
                inverterStatusTextEl.text(inverterStatusText);

                let inverterStatusValueEl = $(`#inverter_${inverterIndex} >> tspan.inverter_status_value`);
                inverterStatusValueEl.text(inverterStatusValue);

                batteries.forEach(battery => {
                    batteryIndex ++;

                    // Calculate the remaining capacity (in kWh) of the battery
                    let remainingAh = battery['Battery_Remaining_Capacity'];
                    let batteryVoltage = battery['Battery_Voltage'];
                    let remainingKWh = (remainingAh * batteryVoltage) / 1000;

                    let stateOfChargeEl = $(`#battery_${inverterIndex}_${batteryIndex} >> tspan.state_of_charge`);
                    stateOfChargeEl.text(Formatters.sensorValue(battery['Battery_SOC'], {
                        suffix: Suffix.Percent
                    }));

                    let remainingCapacityEl = $(`#battery_${inverterIndex}_${batteryIndex} >> tspan.remaining_capacity`);
                    remainingCapacityEl.text(Formatters.sensorValue(remainingKWh, {
                        suffix: Suffix.Energy,
                        formatter: Formatters.roundToOneDecimalPlace
                    }));

                    let temperatureEl = $(`#battery_${inverterIndex}_${batteryIndex} >> tspan.temperature`);
                    temperatureEl.text(Formatters.sensorValue(battery['Battery_Temperature'], {
                        suffix: Suffix.Temperature,
                        formatter: Formatters.roundToWholeNumber
                    }));
                });
            });
        } else if (sensor.type === SensorType.Summary) {
            element.text(Formatters.sensorValue(value, sensor));
        }

        if (sensor.type === SensorType.Power || sensor.type === SensorType.Flow) {
            if (value === 0) {
                // If value is less than 0.01 kW (10 Watts), mark the line/group as Idle
                if (line) {
                    line.setAttribute('marker-end', '');
                }

                group.removeClass('active');
                group.addClass('idle');
            } else {
                // Active
                if (line) {
                    line.setAttribute('marker-end', `url(#${arrow})`);

                    // Redraw the node - fixes an issue where the arrows/markers don't render in Safari
                    let newLine = line.cloneNode(true);
                    line.parentNode.replaceChild(newLine, line);
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

        if (me.processedData && me.processedData['Last_Updated_Time']) {
            const refreshIntervalText = $('#refreshIntervalText');
            const dateUpdated = new Date(me.processedData['Last_Updated_Time']);
            const seconds = Math.round((new Date() - dateUpdated) / 1000);
            const secondsText = Formatters.renderLargeNumber(seconds < 0 ? 0 : seconds);
            const suffix = seconds === 1 ? '': 's';

            refreshIntervalText.text(`Inverter data last updated ${secondsText} second${suffix} ago`);
        }
    }
}

export { App };
window.App = new App();