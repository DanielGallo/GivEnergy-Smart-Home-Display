import { CombinatorType, Prefix, SensorType, Suffix } from './enums.js';
import { Converters } from './converters.js';
import { Formatters } from './formatters.js';

const Sensors = [{
    id: 'Last_Updated_Time',
    mapping: 'Last_Updated_Time',
    combinator: CombinatorType.EarliestDate
}, {
    id: 'Charge_Power',
    mapping: 'Power.Power.Charge_Power',
    combinator: CombinatorType.Addition
}, {
    id: 'Discharge_Power',
    mapping: 'Power.Power.Discharge_Power',
    combinator: CombinatorType.Addition
}, {
    id: 'Load_Power',
    mapping: 'Power.Power.Load_Power',
    type: SensorType.Power,
    textElementId: 'power_home_text',
    converter: Converters.wattsToKw,
    combinator: CombinatorType.Ignore
}, {
    id: 'Grid_Power',
    mapping: 'Power.Power.Grid_Power',
    type: SensorType.Power,
    nonZeroValueCheck: [
        'Solar_to_Grid',
        'Grid_to_Battery',
        'Grid_to_House',
        'Battery_to_Grid'
    ],
    textElementId: 'power_grid_text',
    converter: Converters.wattsToKw,
    forceRefresh: true,
    combinator: CombinatorType.Any
}, {
    id: 'PV_Power',
    mapping: 'Power.Power.PV_Power',
    type: SensorType.Power,
    textElementId: 'power_solar_text',
    converter: Converters.wattsToKw,
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Battery_Power',
    mapping: 'Power.Power.Battery_Power',
    type: SensorType.Power,
    textElementId: 'power_battery_text',
    converter: Converters.wattsToKw,
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Grid_to_Battery',
    mapping: 'Power.Flows.Grid_to_Battery',
    type: SensorType.Flow,
    nonZeroValueCheck: [
        'Grid_Power'
    ],
    flowElementId: 'battery_with_grid',
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Grid_to_House',
    mapping: 'Power.Flows.Grid_to_House',
    type: SensorType.Flow,
    nonZeroValueCheck: [
        'Grid_Power'
    ],
    flowElementId: 'grid_to_home',
    forceRefresh: true,
    combinator: CombinatorType.Any
}, {
    id: 'Solar_to_Battery',
    mapping: 'Power.Flows.Solar_to_Battery',
    type: SensorType.Flow,
    nonZeroValueCheck: [
        'Battery_Power'
    ],
    flowElementId: 'solar_to_battery',
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Solar_to_Grid',
    mapping: 'Power.Flows.Solar_to_Grid',
    type: SensorType.Flow,
    nonZeroValueCheck: [
        'Grid_Power'
    ],
    flowElementId: 'solar_to_grid',
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Solar_to_House',
    mapping: 'Power.Flows.Solar_to_House',
    type: SensorType.Flow,
    flowElementId: 'solar_to_home',
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Battery_to_Grid',
    mapping: 'Power.Flows.Battery_to_Grid',
    type: SensorType.Flow,
    nonZeroValueCheck: [
        'Grid_Power'
    ],
    flowElementId: 'battery_with_grid',
    combinator: CombinatorType.Addition
}, {
    id: 'Battery_to_House',
    mapping: 'Power.Flows.Battery_to_House',
    type: SensorType.Flow,
    flowElementId: 'battery_to_home',
    forceRefresh: true,
    combinator: CombinatorType.Addition
}, {
    id: 'Load_Energy_Today_kWh',
    mapping: 'Energy.Today.Load_Energy_Today_kWh',
    textElementId: 'energy_home_text',
    type: SensorType.Summary,
    suffix: Suffix.Energy,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true,
    combinator: CombinatorType.Average      // All inverters might know about the total load?
}, {
    id: 'PV_Energy_Today_kWh',
    mapping: 'Energy.Today.PV_Energy_Today_kWh',
    textElementId: 'energy_solar_text',
    type: SensorType.Summary,
    suffix: Suffix.Energy,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true,
    combinator: CombinatorType.Addition     // Assumes each inverter has its own solar array
}, {
    id: 'daily_energy_peak',
    mapping: 'Energy.Rates.Day_Energy_kWh',
    textElementId: 'energy_imported_peak_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true,
    combinator: CombinatorType.Average      // All inverters might know about the total load?
}, {
    id: 'daily_energy_offpeak',
    mapping: 'Energy.Rates.Night_Energy_kWh',
    textElementId: 'energy_imported_offpeak_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true,
    combinator: CombinatorType.Average      // All inverters might know about the total load?
}, {
    id: 'Export_Energy_Today_kWh',
    mapping: 'Energy.Today.Export_Energy_Today_kWh',
    textElementId: 'energy_exported_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true,
    combinator: CombinatorType.Average  // Each inverter appears to know the same total export amount, but they're off by a very small amount.
}, {
    id: 'Battery_State',
    textElementId: 'battery_state_text',
    type: SensorType.Summary,
    combinator: CombinatorType.Ignore
}, {
    id: 'Battery_State_of_Charge',
    mapping: 'Power.Power.SOC',
    textElementId: 'battery_percentage_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToWholeNumber,
    suffix: Suffix.Percent,
    combinator: CombinatorType.Average
}, {
    id: 'daily_energy_cost_peak',
    mapping: 'Energy.Rates.Day_Cost',
    textElementId: 'energy_imported_peak_cost_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true,
    combinator: CombinatorType.Average
}, {
    id: 'daily_energy_cost_offpeak',
    mapping: 'Energy.Rates.Night_Cost',
    textElementId: 'energy_imported_offpeak_cost_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true,
    combinator: CombinatorType.Average
}, {
    id: 'Export_Income',
    mapping: 'Energy.Today.Export_Energy_Today_kWh',
    textElementId: 'energy_exported_income',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true,
    combinator: CombinatorType.Average  // Uses the same field above that's averaged across inverters.
}, {
    id: 'Solar_Income',
    mapping: 'Energy.Today.PV_Energy_Today_kWh',
    textElementId: 'solar_generated_income_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true,
    combinator: CombinatorType.Addition     // Assumes each inverter has its own solar array
}, {
    id: 'Battery_Statistics',
    mapping: 'Battery_Details',
    type: SensorType.Summary,
    combinator: CombinatorType.All
}, {
    id: 'Inverter_Details',
    mapping: 'Invertor_Details',
    type: SensorType.Summary,
    combinator: CombinatorType.All
}];

export { Sensors };