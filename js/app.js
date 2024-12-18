import { CombinatorType, SensorType, Suffix } from './enums.js';
import { GatewaySensors, InverterSensors } from './sensors.js';
import { Helpers } from './helpers.js';
import { Formatters } from './formatters.js';
import { Converters } from './converters.js';

class App {
    constructor() {
        const me = this;

        me.givTcpHosts = null;
        me.solarRate = null;
        me.exportRate = null;
        me.processedGatewayData = null;
        me.processedInverterData = null;
        me.inverterRendered = false;
        me.gatewayRendered = false;
        me.debugMode = false;
        me.useSampleData = false;
        me.sampleDataName = null;
        me.baseUrl = null;
        me.singlePhase = true;
        me.singleInverter = true;
        me.summaryOffsetY = 3;

        // Generate URL to GivTCP based on current URL of web app
        let baseUrl = window.location.protocol + '//' + window.location.hostname;

        // But also allow the GivTCP hostname to be passed in as a "hostname" query string param
        const urlParams = new URLSearchParams(window.location.search);
        const hostname = urlParams.get('Hostname');
        const sampleData = urlParams.get('SampleData');
        me.showAdvancedInfo = urlParams.has('ShowAdvancedInfo')
            ? urlParams.get('ShowAdvancedInfo') === 'true'
            : true;
        me.showTime = urlParams.get('ShowTime') === 'true';
        me.debugMode = urlParams.get('DebugMode') === 'true';

        // If the hostname has been overridden, use it
        if (hostname) {
            baseUrl = window.location.protocol + '//' + hostname;
        }

        me.baseUrl = baseUrl;

        // If debug mode is enabled
        if (me.debugMode) {
            $('#debugPanel').show();
            console.log('Debug mode enabled.');
        }

        // For debugging purposes, enable inverter data to be read from static JSON files
        if (sampleData) {
            me.useSampleData = true;
            me.sampleDataName = sampleData;
        }

        if (!me.showAdvancedInfo) {
            $('#inverter_panel').hide();
            $('#panel_divider').hide();
        }

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
                    if (me.givTcpHosts.length > 1) {
                        me.singleInverter = false;
                    }

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

        if (me.useSampleData === false) {
            // Fetch the data from GivTCP every 8 seconds
            setInterval(me.fetchData.bind(me), 8000);
        }
    }

    /**
     * Fetch the latest values from GivTCP
     */
    fetchData() {
        const me = this;
        me.cachedGatewayData = [];
        me.cachedInverterData = [];
        me.processedGatewayData = {};
        me.processedInverterData = {};

        let fetchPromises = me.givTcpHosts.map((givTcpHost, index) => {
            let fetchUrl = `${me.baseUrl}:${givTcpHost.port}/readData`;
            // For debugging purposes, enable inverter data to be read from static JSON files, to see how the dashboard displays it
            if (me.useSampleData) {
                let port = window.location.port;

                fetchUrl = `${me.baseUrl}:${port}/data_samples/${me.sampleDataName}/inverter_${index}_sample.json`;
            }

            return fetch(fetchUrl, {
                mode: 'cors',
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            }).then(response => {
                return response.json();
            }).then(data => {
                let target = me.cachedInverterData;

                if (data.raw
                    && data.raw.invertor
                    && data.raw.invertor.serial_number) {
                    const serialNumber = data.raw.invertor.serial_number;

                    if (serialNumber.startsWith('GW')) {
                        target = me.cachedGatewayData;
                    }
                }

                target.push({
                    name: givTcpHost.name,
                    sortOrder: givTcpHost.sortOrder,
                    data: data
                });
            });
        });

        Promise.all(fetchPromises).then(() => {
            me.cachedInverterData.sort((a, b) => a.sortOrder - b.sortOrder);

            me.onResponse();
        });
    }

    /**
     * Successful response from GivTCP
     */
    onResponse() {
        const me = this;

        if (me.cachedInverterData.length === 0) {
            const refreshIntervalText = $('#refreshIntervalText');
            refreshIntervalText.text(`Error: No inverter data, trying again...`);
            return;
        }

        me.updateRefreshIntervalText();
        setInterval(me.updateRefreshIntervalText.bind(me), 1000);

        me.processedGatewayData = {};
        me.processedInverterData = {};

        const phases = Helpers.getPropertyValueFromMapping(me.cachedInverterData[0].data, 'raw.invertor.num_phases');
        me.singlePhase = phases === 0;

        if (me.debugMode) {
            console.log('Single phase: ', me.singlePhase);
            console.log('Single inverter: ', me.singleInverter);
        }

        InverterSensors.forEach((sensor) => {
            let value = null;
            let combinator = null;

            if (sensor.mapping) {
                if (me.singlePhase && me.singleInverter) {
                    combinator = sensor.combinator.singlePhaseSingleInverter;
                } else if (me.singlePhase && me.singleInverter === false) {
                    combinator = sensor.combinator.singlePhaseMultipleInverters;
                } else {
                    combinator = sensor.combinator.multiplePhases;
                }

                if (combinator === CombinatorType.Addition) {
                    value = 0;

                    me.cachedInverterData.forEach((cachedRecord) => {
                        value += Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping);
                    });
                } else if (combinator === CombinatorType.Any) {
                    value = Helpers.getPropertyValueFromMapping(me.cachedInverterData[0].data, sensor.mapping);
                } else if (combinator === CombinatorType.Average) {
                    let numbers = [];

                    me.cachedInverterData.forEach((cachedRecord) => {
                        numbers.push(Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping));
                    });

                    let sum = numbers.reduce((a, b) => a + b, 0);
                    value = sum / numbers.length;
                } else if (combinator === CombinatorType.EarliestDate) {
                    let dates = [];

                    me.cachedInverterData.forEach((cachedRecord) => {
                        dates.push(new Date(Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping)));
                    });

                    value = new Date(Math.min.apply(null, dates));
                }

                me.processedInverterData[sensor.id] = value;
            }
        });

        const inverterData = me.processedInverterData;

        // If there are one or more Gateways
        if (me.cachedGatewayData.length > 0) {
            GatewaySensors.forEach((sensor) => {
                let value = null;

                if (sensor.id === 'Gateway_Details') {
                    let gateways = [];

                    me.cachedGatewayData.forEach((cachedRecord) => {
                        let mappingPrefix = cachedRecord.data.raw.invertor.serial_number;

                        gateways.push({
                            data: {
                                gatewayMode: Helpers.getPropertyValueFromMapping(me.cachedGatewayData[0].data, `${mappingPrefix}.Gateway_Mode`)
                            }
                        });
                    });

                    value = gateways;
                }

                if (value || sensor.forceRefresh) {
                    me.processItem({
                        sensor: sensor,
                        value: value
                    });
                }
            });
        }

        InverterSensors.forEach((sensor) => {
            let value = me.processedInverterData[sensor.id];

            // Some sensors require custom calculation of the values
            if (sensor.id === 'Battery_State') {
                let chargeRate = inverterData.Charge_Power;
                let dischargeRate = inverterData.Discharge_Power;

                if (dischargeRate > 0) {
                    value = 'Discharging';
                } else if (chargeRate > 0) {
                    value = 'Charging';
                } else {
                    value = 'Idle';
                }
            } else if (sensor.id === 'Load_Power'
                && me.singlePhase === true
                && me.singleInverter === false) {
                if (inverterData.Export_Power === inverterData.Solar_to_Grid
                    && inverterData.Export_Power > 0 && inverterData.Solar_to_Grid > 0) {
                    inverterData.Grid_Power = inverterData.Export_Power;
                }

                // In a single phase environment we need to carefully calculate house load
                // because each inverter treats other inverters as house load (as they're not aware of each other).
                let totalSourcePower = inverterData.PV_Power + inverterData.Discharge_Power + inverterData.Import_Power;
                let loadPower = totalSourcePower - inverterData.Charge_Power - inverterData.Export_Power;

                value = loadPower;

                if (inverterData.Battery_to_House === 0 && inverterData.Solar_to_House === 0 && inverterData.Grid_to_House === 0 && inverterData.Solar_to_Grid > 10) {
                    // With multiple inverters, if solar is the only thing powering the house,
                    // the "Solar_to_House" can be zero (along with the other flows), so ensure
                    // the "solar to house" flow line is still rendered.
                    inverterData.Solar_to_House = 10;
                }

                if (inverterData.Battery_to_House === 0 && inverterData.Grid_to_House === 0 && inverterData.Battery_to_Grid > 10) {
                    // If multiple inverters are exporting, ensure the flow line from the battery to the
                    // house is still flowing.
                    inverterData.Battery_to_House = 10;
                }

                if (inverterData.Charge_Power > 0 && inverterData.Solar_to_House > 0 && inverterData.Solar_to_Grid > 0 && inverterData.Solar_to_Battery === 0 && inverterData.Grid_to_House === 0) {
                    // With multiple inverters on a single phase, when solar is fully powering the house, exporting,
                    // and charging the batteries, there's no flow between solar and batteries. Force this flow to be
                    // rendered.
                    inverterData.Solar_to_Battery = 10;
                }
            } else if (sensor.id === 'Solar_Income') {
                let income = value * me.solarRate;

                value = Converters.numberToCurrency(income);
            } else if (sensor.id === 'Export_Income') {
                let income = value * me.exportRate;

                value = Converters.numberToCurrency(income);
            } else if (sensor.id === 'Inverter_Details') {
                let inverters = [];

                me.cachedInverterData.forEach((cachedRecord) => {
                    let batteryArray = Helpers.getBatteriesFromInverter(
                        Helpers.getPropertyValueFromMapping(cachedRecord.data, 'Battery_Details')
                    );

                    inverters.push({
                        name: cachedRecord.name,
                        data: inverterData,
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
                me.processedInverterData[sensor.id] = 0;
            }

            // Sometimes the flow lines or power sources may have values, but the dependent sensors may all be zero.
            // If the dependent sensors are all zero, also set this sensor value to zero (to prevent the flow lines from
            // rendering, or the values from populating within the circles).
            if (sensor.nonZeroValueCheck && value > 0) {
                let setSensorToZero = true;

                sensor.nonZeroValueCheck.forEach(sensorToCheck => {
                    if (me.debugMode) {
                        console.log(`Perform a non-zero value check from "${sensor.id}" with value ${value}, dependent on "${sensorToCheck}" with value ${me.processedInverterData[sensorToCheck]}.`);
                    }

                    // At least one of the dependent sensors has a non-zero value, so don't reset the source sensor to zero.
                    if (me.processedInverterData[sensorToCheck] !== 0) {
                        setSensorToZero = false;
                    }
                });

                if (setSensorToZero) {
                    if (me.debugMode) {
                        console.log(`Setting "${sensor.id}" to 0 (was ${value}), because the dependent sensor is also zero.`);
                    }

                    value = 0;
                    me.processedInverterData[sensor.id] = 0;
                }
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
        } else if (sensor.type === SensorType.Summary
            && sensor.id === 'Gateway_Details'
            && Array.isArray(value)
            && me.showAdvancedInfo) {
            let gateways = value;
            let svgContainerElement = $('#inverter_panel')[0];
            let svgCloneableGatewayElement = $('#gatewayDetails')[0];
            let gatewayOffsetAddition = 54;
            let gatewayIndex = -1;

            // On first load, render the gateway panel
            if (!me.gatewayRendered) {
                gateways.forEach(gateway => {
                    let svgClonedElement = svgCloneableGatewayElement.cloneNode(true);
                    svgClonedElement.setAttribute('transform', `translate(0, ${me.summaryOffsetY})`);
                    svgClonedElement.setAttribute('style', '');
                    svgClonedElement.setAttribute('id', `gateway_${++ gatewayIndex}`);

                    svgContainerElement.appendChild(svgClonedElement);

                    me.summaryOffsetY = me.summaryOffsetY + gatewayOffsetAddition;
                })

                me.gatewayRendered = true;
            }

            gatewayIndex = -1;

            gateways.forEach(gateway => {
                gatewayIndex ++;

                let modeEl = $(`#gateway_${gatewayIndex} >> tspan.gateway_mode`);
                modeEl.text(gateway.data.gatewayMode);
            });
        } else if (sensor.type === SensorType.Summary
            && sensor.id === 'Inverter_Details'
            && Array.isArray(value)
            && me.showAdvancedInfo) {
            let inverters = value;
            let svgContainerElement = $('#inverter_panel')[0];
            let svgCloneableInverterElement = $('#inverterDetails')[0];
            let svgCloneableBatteryElement = $('#batteryDetails')[0];
            let offsetX = 0;
            let inverterOffsetAddition = 116;
            let batteryOffsetX = 65;
            let batteryOffsetYAddition = 36;
            let batteryPanelStartingPositionX = 162;
            let spacer = 12;
            let inverterIndex = -1;

            // On first load, render the battery statistics panels
            if (!me.inverterRendered) {
                inverters.forEach(inverter => {
                    let svgClonedElement = svgCloneableInverterElement.cloneNode(true);
                    svgClonedElement.setAttribute('transform', `translate(0, ${me.summaryOffsetY})`);
                    svgClonedElement.setAttribute('style', '');
                    svgClonedElement.setAttribute('id', `inverter_${++ inverterIndex}`);

                    svgContainerElement.appendChild(svgClonedElement);

                    let inverterNameEl = $(`#inverter_${inverterIndex} > text.label`);
                    inverterNameEl.text(`Inverter (${inverter.name})`);

                    offsetX = batteryPanelStartingPositionX;
                    me.summaryOffsetY = me.summaryOffsetY + inverterOffsetAddition;

                    // Reverse the batteries, so we draw the last battery to the right side first
                    let batteries = inverter.batteries.reverse();
                    let batteryIndex = batteries.length;

                    // The number of batteries can vary, so iterate over each battery
                    for (let battery in batteries) {
                        let svgClonedElement = svgCloneableBatteryElement.cloneNode(true);
                        svgClonedElement.setAttribute('transform', `translate(${offsetX}, ${me.summaryOffsetY})`);
                        svgClonedElement.setAttribute('style', '');
                        svgClonedElement.setAttribute('id', `battery_${inverterIndex}_${-- batteryIndex}`);

                        svgContainerElement.appendChild(svgClonedElement);

                        offsetX = offsetX - batteryOffsetX;
                    }

                    // Reset reverse order
                    inverter.batteries.reverse();

                    offsetX = 0;
                    me.summaryOffsetY = me.summaryOffsetY + batteryOffsetYAddition + spacer;
                })

                me.inverterRendered = true;
            }

            inverterIndex = -1;

            // Now populate or update the values being shown in the inverter and battery statistics panels
            inverters.forEach(inverter => {
                inverterIndex ++;
                let batteries = inverter.batteries;
                let batteryIndex = -1;

                let stateOfChargeEl = $(`#inverter_${inverterIndex} >> tspan.inverter_soc`);
                stateOfChargeEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.SOC'), {
                    suffix: Suffix.Percent,
                    formatter: Formatters.roundToWholeNumber
                }));

                let solarPowerEl = $(`#inverter_${inverterIndex} >> tspan.solar_power`);
                solarPowerEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.PV_Power'), {
                    converter: Converters.wattsToKw,
                    suffix: Suffix.Power
                }));

                let targetChargeEl = $(`#inverter_${inverterIndex} >> tspan.target_soc`);
                targetChargeEl.text(Formatters.sensorValue(Helpers.getPropertyValueFromMapping(inverter.rawData, 'Control.Target_SOC'), {
                    suffix: Suffix.Percent
                }));

                let inverterStatus = 'Batteries Idle';
                let inverterRate = null;
                let chargeRate = Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.Charge_Power');
                let dischargeRate = Helpers.getPropertyValueFromMapping(inverter.rawData, 'Power.Power.Discharge_Power');

                if (dischargeRate > 0) {
                    inverterStatus = 'Discharging';
                    inverterRate = dischargeRate;
                } else if (chargeRate > 0) {
                    inverterStatus = 'Charging';
                    inverterRate = chargeRate;
                }

                if (inverterRate != null) {
                    inverterStatus += ' ' + Formatters.sensorValue(inverterRate, {
                        converter: Converters.wattsToKw,
                        suffix: Suffix.Power
                    });
                }

                let inverterStatusEl = $(`#inverter_${inverterIndex} >> tspan.inverter_status`);
                inverterStatusEl.text(inverterStatus);

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
                });
            });
        } else if (sensor.type === SensorType.Summary && !Array.isArray(value)) {
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

            if (me.debugMode) {
                // Show all values if the app is in debug mode
                let debugEl = $(`#debug_${sensor.id}`);
                if (debugEl) {
                    debugEl.text(value);
                }
            }
        }
    }

    resizeCanvas() {
        let me = this;
        let width = document.body.clientWidth;
        let height = document.body.clientHeight;
        let canvas = $('#canvas')[0];

        if (width > height) {
            // Landscape mode
            if (me.showAdvancedInfo) {
                canvas.setAttribute('viewBox', '0 0 840 375');
            } else {
                canvas.setAttribute('viewBox', '0 0 620 375');
            }
            $('#diagram')[0].setAttribute('transform', '');
            $('#panels')[0].setAttribute('transform', '');
        } else {
            // Portrait mode
            if (me.showAdvancedInfo) {
                canvas.setAttribute('viewBox', '0 0 500 880');
                $('#diagram')[0].setAttribute('transform', 'translate(-2, 0), scale(1.4)');
                $('#panels')[0].setAttribute('transform', 'translate(-392, 510), scale(1.07)');
            } else {
                canvas.setAttribute('viewBox', '0 0 500 960');
                $('#diagram')[0].setAttribute('transform', 'translate(-2, 0), scale(1.4)');
                $('#panels')[0].setAttribute('transform', 'translate(-370, 510), scale(1.28)');
            }
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

        if (me.showTime) {
            me.updateTime();
        }

        if (me.processedInverterData && me.processedInverterData['Last_Updated_Time']) {
            const refreshIntervalText = $('#refreshIntervalText');
            const dateUpdated = new Date(me.processedInverterData['Last_Updated_Time']);

            if (isNaN(dateUpdated.getTime())) {
                refreshIntervalText.text(`Error: Invalid response, trying again...`);
            } else {
                const seconds = Math.round((new Date() - dateUpdated) / 1000);
                const secondsText = Formatters.renderLargeNumber(seconds < 0 ? 0 : seconds);
                const suffix = seconds === 1 ? '': 's';

                refreshIntervalText.text(`Inverter data last updated ${secondsText} second${suffix} ago`);
            }
        }
    }

    /**
     * Downloads the inverter data as JSON files from the cached data, so they can be debugged later when the data changes.
     * Each file is named in the format "inverter_{{index}}_sample.json".
     *
     * @return {void}
     */
    downloadInverterData() {
        var me = this;

        me.cachedInverterData.forEach((cachedInverterDataItem, index) => {
            const jsonStr = JSON.stringify(cachedInverterDataItem.data, null, 2);

            const blob = new Blob([jsonStr], { type: 'application/json' });

            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `inverter_${index}_sample.json`;
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }
}

export { App };
window.App = new App();