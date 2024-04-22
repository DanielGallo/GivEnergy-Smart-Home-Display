class Helpers {
    /**
     * Traverses a nested object by processing a dot-delimited string
     * @param obj The object to traverse
     * @param mapping The mapping (a dot-delimited string)
     * @returns {*} The value of the nested object
     */
    static getPropertyValueFromMapping(obj, mapping) {
        let properties = mapping.split('.');

        for (let i in properties) {
            obj = obj[properties[i]];
        }

        return obj;
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

        Object.keys(batteries).forEach(key => {
            if (typeof batteries[key] === 'object' && batteries[key] !== null) {
                filtered[key] = batteries[key];
            }
        });

        return Object.keys(filtered).map(function(key) {
            return filtered[key];
        });
    }
}

export { Helpers };