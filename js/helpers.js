import {InverterSensors} from "./sensors.js";

class Helpers {
    /**
     * Traverses a nested object by processing a dot-delimited string
     * @param obj The object to traverse
     * @param mapping The mapping (a dot-delimited string)
     * @returns {*} The value of the nested object
     */
    static getPropertyValueFromMapping(obj, mapping) {
        // Mapping could be a single string, or an array of strings (where we need to find a mapping that exists).
        // This is because the mappings may differ between GivTCP v2 and v3, so we need to search multiple possible mappings.
        const mappings = Array.isArray(mapping) ? mapping : [mapping];

        for (const map of mappings) {
            let currentObj = obj;
            const properties = map.split('.');

            for (const property of properties) {
                if (currentObj && property in currentObj) {
                    currentObj = currentObj[property];
                } else {
                    currentObj = undefined;
                    break;
                }
            }

            if (currentObj !== undefined) {
                return currentObj;
            }
        }

        return undefined;
    }

    /**
     * Extracts battery objects and returns the batteries in an array.
     * Filters out any properties under the `batteries` collection that aren't an object
     * (e.g. strings `BMS_Temperature` and `BMS_Voltage`).
     * @param batteries The raw batteries object from the inverter
     * @returns {*[]} The filtered array of batteries
     */
    static getBatteriesFromInverter(batteries) {
        const filtered = {};
        let batteriesObject = batteries;

        // GivTCP v3 added the batteries under a nested object called `Battery_Stack_1`
        if (typeof batteries.Battery_Stack_1 !== 'undefined') {
            batteriesObject = batteries.Battery_Stack_1;
        }

        Object.keys(batteriesObject).forEach(key => {
            if (typeof batteriesObject[key] === 'object'
                && batteriesObject[key] !== null
                && batteriesObject[key].Battery_SOC) {
                filtered[key] = batteriesObject[key];
            }
        });

        return Object.keys(filtered).map(function(key) {
            return filtered[key];
        });
    }

    /**
     * Retrieves a sensor object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the sensor to retrieve.
     * @return {Object|undefined} The sensor object matching the id, or undefined if not found.
     */
    static getSensorById(id) {
        return InverterSensors.find(sensor => sensor.id === id);
    }

    /**
     * Clamps a power value in watts to zero if it is below the minimum meaningful threshold (10 W).
     * Values below this threshold are treated as noise/idle and should not be rendered.
     * @param {number} watts The power value in watts
     * @returns {number} The clamped value
     */
    static clampPower(watts) {
        return watts < 10 ? 0 : watts;
    }

    /**
     * Calculates the power flow breakdown for a 3-phase inverter.
     * 3-phase inverters don't return flow data from GivTCP, so the flows are derived from
     * the available power values using a priority-based dispatch model.
     * @param {Object} baseData Flat map of sensor IDs to their current values
     * @returns {Object} Flow values keyed by flow name (e.g. Solar_to_House, Grid_to_Battery)
     */
    static calculateThreePhaseFlows(baseData) {
        let batteryToGrid = 0;
        let batteryToHouse = 0;
        let gridToBattery = 0;
        let gridToHouse = 0;
        let solarToBattery = 0;
        let solarToGrid = 0;
        let solarToHouse = 0;

        let remainingSolar = baseData.PV_Power;
        let remainingGrid = baseData.Grid_Power;
        let remainingLoad = baseData.Load_Power;

        // Supply the house load first from solar
        if (remainingSolar >= remainingLoad) {
            solarToHouse = remainingLoad;
            remainingSolar -= remainingLoad;
            remainingLoad = 0;
        } else {
            solarToHouse = remainingSolar;
            remainingLoad -= remainingSolar;
            remainingSolar = 0;
        }

        // Battery discharges to cover remaining load
        if (remainingLoad > 0 && baseData.Discharge_Power > 0) {
            if (baseData.Discharge_Power >= remainingLoad) {
                batteryToHouse = remainingLoad;
                remainingLoad = 0;
            } else {
                batteryToHouse = baseData.Discharge_Power;
                remainingLoad -= baseData.Discharge_Power;
            }
        }

        // Grid covers any remaining load
        if (remainingLoad > 0 && remainingGrid > 0) {
            if (remainingGrid >= remainingLoad) {
                gridToHouse = remainingLoad;
                remainingGrid -= remainingLoad;
                remainingLoad = 0;
            } else {
                gridToHouse = remainingGrid;
                remainingLoad -= remainingGrid;
                remainingGrid = 0;
            }
        }

        // Remaining solar charges the battery; shortfall comes from the grid
        if (baseData.Charge_Power > 0) {
            if (remainingSolar >= baseData.Charge_Power) {
                solarToBattery = baseData.Charge_Power;
                remainingSolar -= baseData.Charge_Power;
            } else {
                solarToBattery = remainingSolar;
                remainingSolar = 0;
                gridToBattery = baseData.Charge_Power - solarToBattery;
            }
        }

        // Any surplus solar is exported to the grid
        if (remainingSolar > 0) {
            solarToGrid = remainingSolar;
        }

        // Any battery discharge beyond house load goes to the grid
        if (baseData.Discharge_Power > batteryToHouse) {
            batteryToGrid = baseData.Discharge_Power - batteryToHouse;
        }

        return {
            Battery_to_Grid: batteryToGrid,
            Battery_to_House: batteryToHouse,
            Grid_to_Battery: gridToBattery,
            Grid_to_House: gridToHouse,
            Solar_to_Battery: solarToBattery,
            Solar_to_Grid: solarToGrid,
            Solar_to_House: solarToHouse
        };
    }

    /**
     * Finds the Gateway_Mode value from a gateway's data payload.
     * The gateway details live under a top-level key named after the gateway's serial number.
     * If the serial number is absent (e.g. anonymised sample data), scan all top-level keys
     * for the one that contains a Gateway_Mode property.
     * @param {Object} data The raw data payload for a gateway device
     * @returns {string|null} The Gateway_Mode string, or null if not found
     */
    static getGatewayMode(data) {
        const serial = data.raw && data.raw.invertor && data.raw.invertor.serial_number;

        if (serial) {
            const mode = this.getPropertyValueFromMapping(data, `${serial}.Gateway_Mode`);
            if (mode !== undefined) return mode;
        }

        for (const key of Object.keys(data)) {
            const val = data[key];
            if (val && typeof val === 'object' && 'Gateway_Mode' in val) {
                return val['Gateway_Mode'];
            }
        }

        return null;
    }

    /**
     * Checks whether the provided inverter data corresponds to a 3-phase inverter.
     *
     * @param {Object} inverter - The inverter data to analyse.
     * @return {Boolean} Returns `true` if the inverter is detected as 3-phase, otherwise `false`.
     */
    static isThreePhaseInverter(inverter) {
        // First, check if the number of phases is set to 3 in the data.
        const phases = this.getPropertyValueFromMapping(inverter.data, 'raw.invertor.num_phases');

        if (phases === 3) {
            return true;
        }

        // `num_phases` can still be zero in GivTCP when we are dealing with a 3-phase inverter,
        // so attempt to fix that here by also checking the raw model name (it may contain "3ph").
        const rawModel = this.getPropertyValueFromMapping(inverter.data, 'raw.invertor.model');
        let inverterType = null;

        // Raw model name may not be helpful - also check the inverter type (description)
        if (inverter.serialNumber !== null) {
            inverterType = this.getPropertyValueFromMapping(inverter.data, `${inverter.serialNumber}.Invertor_Type`);
        }

        if ((typeof rawModel === 'string' && rawModel.includes('3ph'))
            || (typeof inverterType === 'string' && inverterType.includes('3ph'))) {
            return true;
        }

        return false;
    }
}

export { Helpers };