import { CombinatorType, SensorType, Suffix } from './enums.js';
import { GatewaySensors, InverterSensors } from './sensors.js';
import { Helpers } from './helpers.js';
import { Formatters } from './formatters.js';
import { Converters } from './converters.js';

class App {
    constructor() {
        const me = this;

        me.fetchInterval = null;
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
        me.hasEvc = false;
        me.cachedEvcData = null;
        me.evcRendered = false;

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

        // Handle visibility changes to pause/resume fetching
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden" && me.fetchInterval) {
                clearInterval(me.fetchInterval);
                me.fetchInterval = null;

                if (me.debugMode) {
                    console.log("Paused data fetching due to tab being hidden.");
                }
            } else if (document.visibilityState === "visible" && !me.fetchInterval) {
                me.launch(); // Relaunch fetch when tab is visible again

                if (me.debugMode) {
                    console.log("Resumed data fetching as tab is visible.");
                }
            }
        });

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

                if (me.givTcpHosts !== null && me.solarRate !== null && me.exportRate !== null) {
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

        // Hide EVC elements until presence is confirmed by the first data fetch
        me.renderEvcVisibility();
    }

    /**
     * Fetch the initial set of data and set up a routine to fetch the data every 10 seconds
     */
    launch() {
        const me = this;

        // Clear existing interval if it exists
        if (me.fetchInterval) {
            clearInterval(me.fetchInterval);
        }

        // Get the initial set of data
        me.fetchData();

        if (me.useSampleData === false) {
            // Fetch the data from GivTCP every 8 seconds
            me.fetchInterval = setInterval(me.fetchData.bind(me), 8000);
        }
    }

    /**
     * Fetch the latest values from GivTCP
     */
    fetchData() {
        const me = this;

        // Skip if a fetch operation is already in progress
        if (me.fetching) {
            return;
        }
        me.fetching = true;

        me.cachedGatewayData = [];
        me.cachedInverterData = [];
        me.processedGatewayData = {};
        me.processedInverterData = {};
        me.cachedEvcData = null;

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
                let serialNumber = null;

                if (data.raw
                    && data.raw.invertor
                    && data.raw.invertor.serial_number) {
                    serialNumber = data.raw.invertor.serial_number;

                    // If the device is a Gateway, add it to the Gateway data instead of the Inverter data
                    if (serialNumber.startsWith('GW')) {
                        target = me.cachedGatewayData;
                    }
                }

                target.push({
                    name: givTcpHost.name,
                    sortOrder: givTcpHost.sortOrder,
                    data: data,
                    serialNumber: serialNumber
                });
            });
        });

        // Fetch EVC data alongside inverter data — a missing file (sample mode) or 500 (live mode, no EVC fitted)
        // both resolve with null rather than rejecting, so a missing EVC never blocks inverter rendering.
        let evcFetchUrl;
        if (me.useSampleData) {
            let port = window.location.port;
            evcFetchUrl = `${me.baseUrl}:${port}/data_samples/${me.sampleDataName}/evc.json`;
        } else {
            evcFetchUrl = `${me.baseUrl}/getEVCCache`;
        }

        const evcFetchPromise = fetch(evcFetchUrl, {
            mode: 'cors',
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        })
        .then(response => {
            if (!response.ok) {
                return null;
            }
            return response.json();
        })
        .then(data => {
            me.cachedEvcData = data;
        })
        .catch(() => {
            me.cachedEvcData = null;
        });

        Promise.all([...fetchPromises, evcFetchPromise])
            .then(() => {
                me.cachedInverterData.sort((a, b) => a.sortOrder - b.sortOrder);

                if (me.cachedInverterData.length === 1) {
                    me.singleInverter = true;
                }

                me.onResponse();
            })
            .finally(() => {
                me.fetching = false;
            });
    }

    /**
     * Successful response from GivTCP
     */
    onResponse() {
        const me = this;
        const refreshIntervalText = $('#refreshIntervalText');

        if (me.cachedInverterData.length === 0) {
            refreshIntervalText.text(`Error: No inverter data, trying again...`);
            return;
        }

        me.singlePhase = !Helpers.isThreePhaseInverter(me.cachedInverterData[0]);

        me.updateRefreshIntervalText();
        setInterval(me.updateRefreshIntervalText.bind(me), 1000);

        me.processedGatewayData = {};
        me.processedInverterData = {};

        me.cachedInverterData.forEach((cachedRecord, index) => {
            // Along with the unified/calculated inverter data we store under `processedInverterData`, we also store each
            // inverter's data in its own object (for summarising within the inverter details panel).
            me.processedInverterData[index] = {};
        });

        if (me.debugMode) {
            console.log('Single phase: ', me.singlePhase);
            console.log('Single inverter: ', me.singleInverter);
        }

        // 3-phase inverters don't return power flows, so derive them from the available power values.
        if (!me.singlePhase) {
            me.cachedInverterData.forEach((cachedRecord, index) => {
                if (Helpers.getPropertyValueFromMapping(cachedRecord.data, 'Power.Flows') === undefined) {
                    let baseData = {};

                    InverterSensors.forEach((sensor) => {
                        if (sensor.mapping) {
                            baseData[sensor.id] = Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping);
                        }
                    });

                    // The "meter" values are more accurate and reflect actual export
                    baseData.Export_Power = baseData.Meter_Export_Power;
                    cachedRecord.data.Power.Power.Import_Power = baseData.Meter_Import_Power;
                    cachedRecord.data.Power.Power.Export_Power = baseData.Meter_Export_Power;

                    if (baseData.Meter_Import_Power > 0) {
                        baseData.Grid_Power = baseData.Meter_Import_Power * -1;
                    } else {
                        baseData.Grid_Power = baseData.Meter_Export_Power;
                    }
                    cachedRecord.data.Power.Power.Grid_Power = baseData.Grid_Power;

                    // Battery_Power is not included in 3-phase Power values, so derive it
                    cachedRecord.data.Power.Power.Battery_Power = baseData.Charge_Power > 0
                        ? baseData.Charge_Power * -1
                        : baseData.Discharge_Power;

                    cachedRecord.data.Power.Flows = Helpers.calculateThreePhaseFlows(baseData);
                }
            });
        }

        // First pass: combine each sensor's values across inverters using its configured combinator
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

                me.cachedInverterData.forEach((cachedRecord, index) => {
                    me.processedInverterData[index][sensor.id] = Helpers.getPropertyValueFromMapping(cachedRecord.data, sensor.mapping);
                });

                if (combinator === CombinatorType.Addition) {
                    value = 0;

                    me.cachedInverterData.forEach((cachedRecord, index) => {
                        value += me.processedInverterData[index][sensor.id];
                    });
                } else if (combinator === CombinatorType.Any) {
                    value = me.processedInverterData[0][sensor.id];
                } else if (combinator === CombinatorType.Average) {
                    let numbers = [];

                    me.cachedInverterData.forEach((cachedRecord, index) => {
                        numbers.push(me.processedInverterData[index][sensor.id]);
                    });

                    let sum = numbers.reduce((a, b) => a + b, 0);
                    value = sum / numbers.length;
                } else if (combinator === CombinatorType.EarliestDate) {
                    let dates = [];

                    me.cachedInverterData.forEach((cachedRecord, index) => {
                        dates.push(new Date(me.processedInverterData[index][sensor.id]));
                    });

                    value = new Date(Math.min.apply(null, dates));
                }

                me.processedInverterData[sensor.id] = value;
            }
        });

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

        // Second pass: derive any computed sensor values, then render each sensor
        InverterSensors.forEach((sensor) => {
            let value = me.deriveSensorValue(sensor, me.processedInverterData[sensor.id]);

            if (value || sensor.forceRefresh) {
                me.processItem({ sensor, value });
            }
        });

        me.hasEvc = (me.cachedEvcData !== null && me.cachedEvcData !== undefined && me.cachedEvcData.Charger !== undefined);
        me.renderEvcVisibility();

        if (me.hasEvc) {
            me.renderEvc();
        }

        me.scaleSummaryPanels();
    }

    /**
     * Returns the final value for a sensor, applying any derivation logic that cannot be expressed
     * as a simple mapping or combinator. Returns the raw value unchanged for sensors with no special logic.
     */
    deriveSensorValue(sensor, value) {
        const me = this;

        switch (sensor.id) {
            case 'Battery_State':
                return me.deriveBatteryState();
            case 'Load_Power':
                return (me.singlePhase && !me.singleInverter) ? me.deriveLoadPower() : value;
            case 'Solar_Income':
                return Converters.numberToCurrency(value * me.solarRate);
            case 'Export_Income':
                return Converters.numberToCurrency(value * me.exportRate);
            case 'Inverter_Details':
                return me.deriveInverterDetails();
            default:
                return value;
        }
    }

    /**
     * Derives the human-readable battery state string from the current charge/discharge rates.
     */
    deriveBatteryState() {
        const inverterData = this.processedInverterData;

        if (inverterData.Discharge_Power > 0) return 'Discharging';
        if (inverterData.Charge_Power > 0) return 'Charging';
        return 'Idle';
    }

    /**
     * Derives the house load power in a multi-inverter single-phase setup, where each inverter
     * incorrectly counts the others as load. Also applies flow-line corrections so the diagram
     * renders sensibly when flows are zero but power is flowing through the system.
     */
    deriveLoadPower() {
        const me = this;
        const inverterData = me.processedInverterData;

        if (inverterData.Export_Power === inverterData.Solar_to_Grid
            && inverterData.Export_Power > 0 && inverterData.Solar_to_Grid > 0) {
            inverterData.Grid_Power = inverterData.Export_Power;
        }

        let totalSourcePower = inverterData.PV_Power + inverterData.Discharge_Power + inverterData.Import_Power;
        let loadPower = totalSourcePower - inverterData.Charge_Power - inverterData.Export_Power;

        // With multiple inverters, if solar alone powers the house, Solar_to_House can be zero.
        // Force the flow to render so the diagram doesn't look broken.
        if (inverterData.Battery_to_House === 0
            && inverterData.Solar_to_House === 0
            && inverterData.Grid_to_House === 0
            && inverterData.Solar_to_Grid > 10) {
            inverterData.Solar_to_House = 10;
        }

        // If multiple inverters are exporting, ensure the battery-to-house flow still renders.
        if (inverterData.Battery_to_House === 0
            && inverterData.Grid_to_House === 0
            && inverterData.Battery_to_Grid > 10) {
            inverterData.Battery_to_House = 10;
        }

        // With multiple inverters on a single phase, when solar fully powers the house, exports,
        // and charges batteries simultaneously, force solar-to-battery flow to render.
        if (inverterData.Charge_Power > 0
            && inverterData.Solar_to_House > 0
            && inverterData.Solar_to_Grid > 0
            && inverterData.PV_Power > 10
            && inverterData.Solar_to_Battery === 0
            && inverterData.Grid_to_House === 0) {
            inverterData.Solar_to_Battery = 10;
        }

        return loadPower;
    }

    /**
     * Builds the inverter details array used to render the per-inverter summary panels.
     */
    deriveInverterDetails() {
        const me = this;
        const inverterData = me.processedInverterData;

        return me.cachedInverterData.map((cachedRecord, index) => ({
            name: cachedRecord.name,
            data: inverterData[index],
            rawData: cachedRecord.data,
            batteries: Helpers.getBatteriesFromInverter(inverterData[index].Battery_Details)
        }));
    }

    /**
     * This takes an individual sensor data object and based on its type (power usage, power flow, summary),
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
            value = Helpers.clampPower(value);
            if (value === 0) {
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
            element.text(Formatters.sensorValue(value, sensor, true, true));

            if (group.children('line').length > 0) {
                line = group.children('line')[0];
            }
        } else if (sensor.type === SensorType.Summary
            && sensor.id === 'Gateway_Details'
            && Array.isArray(value)
            && me.showAdvancedInfo) {
            me.renderGatewayDetails(value);
        } else if (sensor.type === SensorType.Summary
            && sensor.id === 'Inverter_Details'
            && Array.isArray(value)
            && me.showAdvancedInfo) {
            me.renderInverterDetails(value);
        } else if (sensor.type === SensorType.Summary && !Array.isArray(value)) {
            element.text(Formatters.sensorValue(value, sensor));
        }

        if (sensor.type === SensorType.Power || sensor.type === SensorType.Flow) {
            me.setActiveState(group, line, arrow, value !== 0);

            if (me.debugMode) {
                // Show all values if the app is in debug mode
                let debugEl = $(`#debug_${sensor.id}`);
                if (debugEl) {
                    debugEl.text(value);
                }
            }
        }
    }

    /**
     * Toggles the active/idle CSS classes on a group element and, if a flow line is present,
     * sets or clears the arrow marker and redraws the node to fix a Safari rendering bug.
     * @param {jQuery} group The jQuery group element to toggle
     * @param {Element|null} line The raw SVG line/path element, or null if none
     * @param {string|null} arrowMarkerId The marker ID to apply (e.g. 'line-arrow'), or null if no line
     * @param {boolean} isActive Whether the element should be active
     */
    setActiveState(group, line, arrowMarkerId, isActive) {
        if (isActive) {
            if (line) {
                line.setAttribute('marker-end', `url(#${arrowMarkerId})`);

                // Redraw the node - fixes an issue where the arrows/markers don't render in Safari
                let newLine = line.cloneNode(true);
                line.parentNode.replaceChild(newLine, line);
            }

            group.removeClass('idle').addClass('active');
        } else {
            if (line) line.setAttribute('marker-end', '');
            group.removeClass('active').addClass('idle');
        }
    }

    /**
     * Renders or updates the gateway summary panel(s) in the advanced info section.
     * @param {Array} gateways Array of gateway objects with data payloads
     */
    renderGatewayDetails(gateways) {
        const me = this;
        let svgContainerElement = $('#inverter_panel')[0];
        let svgCloneableGatewayElement = $('#gatewayDetails')[0];
        let gatewayOffsetAddition = 54;
        let gatewayIndex = -1;

        // On first load, clone and append the gateway panel template for each gateway
        if (!me.gatewayRendered) {
            gateways.forEach(gateway => {
                let svgClonedElement = svgCloneableGatewayElement.cloneNode(true);
                svgClonedElement.setAttribute('transform', `translate(0, ${me.summaryOffsetY})`);
                svgClonedElement.setAttribute('style', '');
                svgClonedElement.setAttribute('id', `gateway_${++gatewayIndex}`);

                svgContainerElement.appendChild(svgClonedElement);

                me.summaryOffsetY += gatewayOffsetAddition;
            });

            me.gatewayRendered = true;
            gatewayIndex = -1;
        }

        gateways.forEach(gateway => {
            gatewayIndex++;

            let modeEl = $(`#gateway_${gatewayIndex} >> tspan.gateway_mode`);
            modeEl.text(gateway.data.gatewayMode);
        });
    }

    /**
     * Renders or updates the inverter and battery summary panels in the advanced info section.
     * On the first call, panel elements are cloned from the SVG templates and appended.
     * Subsequent calls update the displayed values in place.
     * @param {Array} inverters Array of inverter objects with data, rawData, and battery payloads
     */
    renderInverterDetails(inverters) {
        const me = this;
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

        // On first load, render the inverter and battery statistics panels
        if (!me.inverterRendered) {
            inverters.forEach(inverter => {
                let svgClonedElement = svgCloneableInverterElement.cloneNode(true);
                svgClonedElement.setAttribute('transform', `translate(0, ${me.summaryOffsetY})`);
                svgClonedElement.setAttribute('style', '');
                svgClonedElement.setAttribute('id', `inverter_${++inverterIndex}`);

                svgContainerElement.appendChild(svgClonedElement);

                let inverterNameEl = $(`#inverter_${inverterIndex} > text.label`);
                inverterNameEl.text(`Inverter (${inverter.name})`);

                offsetX = batteryPanelStartingPositionX;
                me.summaryOffsetY += inverterOffsetAddition;

                // Reverse the batteries, so we draw the last battery to the right side first
                let batteries = inverter.batteries.reverse();
                let batteryIndex = batteries.length;

                // Scale batteries down proportionally when more than 3, so they fit on one row
                let batteryScale = Math.min(1, 3 / batteries.length);
                let batteryShift = batteryPanelStartingPositionX * (1 - batteryScale);
                let batteryGroupElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                batteryGroupElement.setAttribute('transform', `translate(${batteryShift}, ${me.summaryOffsetY}) scale(${batteryScale})`);
                svgContainerElement.appendChild(batteryGroupElement);

                // The number of batteries can vary, so iterate over each battery
                for (let battery in batteries) {
                    let svgClonedElement = svgCloneableBatteryElement.cloneNode(true);
                    svgClonedElement.setAttribute('transform', `translate(${offsetX}, 0)`);
                    svgClonedElement.setAttribute('style', '');
                    svgClonedElement.setAttribute('id', `battery_${inverterIndex}_${--batteryIndex}`);

                    batteryGroupElement.appendChild(svgClonedElement);

                    offsetX -= batteryOffsetX;
                }

                // Reset reverse order
                inverter.batteries.reverse();

                offsetX = 0;
                me.summaryOffsetY += batteryOffsetYAddition + spacer;
            });

            me.inverterRendered = true;
            inverterIndex = -1;
        }

        // Now populate or update the values being shown in the inverter and battery statistics panels
        inverters.forEach(inverter => {
            inverterIndex++;
            let batteries = inverter.batteries;
            let batteryIndex = -1;

            $(`#inverter_${inverterIndex} >> tspan.inverter_soc`).text(
                Formatters.sensorValue(inverter.data.Battery_State_of_Charge, Helpers.getSensorById('Battery_State_of_Charge'))
            );

            $(`#inverter_${inverterIndex} >> tspan.solar_power`).text(
                Formatters.sensorValue(inverter.data.PV_Power, Helpers.getSensorById('PV_Power'))
            );

            $(`#inverter_${inverterIndex} >> tspan.target_soc`).text(
                Formatters.sensorValue(inverter.data.Battery_Target_State_of_Charge, Helpers.getSensorById('Battery_Target_State_of_Charge'))
            );

            let inverterStatus = 'Batteries Idle';
            let inverterRate = null;
            let chargeRate = inverter.data.Charge_Power;
            let dischargeRate = inverter.data.Discharge_Power;

            if (dischargeRate > 0) {
                inverterStatus = 'Discharging';
                inverterRate = dischargeRate;
            } else if (chargeRate > 0) {
                inverterStatus = 'Charging';
                inverterRate = chargeRate;
            }

            if (inverterRate !== null) {
                inverterStatus += ' ' + Formatters.sensorValue(inverterRate, {
                    converter: Converters.wattsToKw,
                    suffix: Suffix.Power
                });
            }

            $(`#inverter_${inverterIndex} >> tspan.inverter_status`).text(inverterStatus);

            batteries.forEach(battery => {
                batteryIndex++;

                // Calculate the remaining capacity (in kWh) of the battery
                let remainingAh = battery['Battery_Remaining_Capacity'];
                let batteryVoltage = battery['Battery_Voltage'];
                let remainingKWh = (remainingAh * batteryVoltage) / 1000;

                $(`#battery_${inverterIndex}_${batteryIndex} >> tspan.state_of_charge`).text(
                    Formatters.sensorValue(battery['Battery_SOC'], { suffix: Suffix.Percent })
                );

                $(`#battery_${inverterIndex}_${batteryIndex} >> tspan.remaining_capacity`).text(
                    Formatters.sensorValue(remainingKWh, {
                        suffix: Suffix.Energy,
                        formatter: Formatters.roundToOneDecimalPlace
                    })
                );
            });
        });
    }

    renderEvcVisibility() {
        const me = this;

        if (me.hasEvc) {
            $('#power_evc').show();
            $('#home_to_evc').show();
        } else {
            $('#power_evc').hide();
            $('#home_to_evc').hide();
        }
    }

    renderEvc() {
        const me = this;
        const charger = me.cachedEvcData.Charger;

        let activePowerW = Helpers.clampPower(charger.Active_Power ?? 0);
        const activePowerKw = Converters.wattsToKw(activePowerW);

        // Power circle
        const evcTextEl = $('#power_evc_text');
        const evcGroup = $('#power_evc');

        evcTextEl.text(activePowerKw);
        me.setActiveState(evcGroup, null, null, activePowerW > 0);

        // Flow line
        const flowGroup = $('#home_to_evc');
        const flowLine = flowGroup.children('line')[0];

        me.setActiveState(flowGroup, flowLine, 'line-arrow-evc', activePowerW > 0);

        // Summary panel
        if (me.showAdvancedInfo) {
            const svgContainerElement = $('#inverter_panel')[0];

            if (!me.evcRendered) {
                const svgClonedElement = $('#evcDetails')[0].cloneNode(true);
                svgClonedElement.setAttribute('transform', `translate(0, ${me.summaryOffsetY})`);
                svgClonedElement.setAttribute('style', '');
                svgClonedElement.setAttribute('id', 'evc_panel');

                svgContainerElement.appendChild(svgClonedElement);

                me.summaryOffsetY += 68;
                me.evcRendered = true;
            }

            const sessionEnergy = charger.Charge_Session_Energy ?? 0;
            const maxChargeCurrent = charger.Charge_Limit ?? 0;

            const chargingState = charger.Charging_State ?? '—';
            const statusText = activePowerW > 0 ? `${chargingState} ${activePowerKw} kW` : chargingState;
            $('#evc_panel >> tspan.charging_state').text(statusText);
            $('#evc_panel >> tspan.charge_limit').text(`${maxChargeCurrent}A`);
            $('#evc_panel >> tspan.charge_session_energy').text(`${sessionEnergy.toFixed(2)} kWh`);
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

        me.scaleSummaryPanels();
    }

    scaleSummaryPanels() {
        const me = this;

        if (!me.showAdvancedInfo || !me.inverterRendered) return;

        const isLandscape = document.body.clientWidth > document.body.clientHeight;
        const panelOriginY = 19;
        // Portrait: the original layout had ~5px of imperceptible overflow for 2 inverters.
        // Adding that tolerance back prevents unnecessary scaling in the 2-inverter case.
        const availableHeight = isLandscape
            ? 375 - panelOriginY - 10
            : (880 - 510) / 1.07 - panelOriginY + 5;

        const scale = Math.min(1, availableHeight / me.summaryOffsetY);
        $('#inverter_panel')[0].setAttribute('transform', `translate(610, ${panelOriginY}) scale(${scale})`);
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
