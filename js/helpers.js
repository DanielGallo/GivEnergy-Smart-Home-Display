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
}

export { Helpers };