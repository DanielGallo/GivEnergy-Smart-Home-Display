import { Prefix, SensorType, Suffix } from './enums.js';
import { Converters } from './converters.js';
import { Formatters } from './formatters.js';

const Sensors = [{
    id: 'Load_Power',
    mapping: 'Power.Power.Load_Power',
    type: SensorType.Power,
    textElementId: 'power_home_text',
    converter: Converters.wattsToKw
}, {
    id: 'Import_Power',
    mapping: 'Power.Power.Import_Power',
    type: SensorType.Power,
    textElementId: 'power_grid_text',
    inverse: 'givtcp_export_power',
    converter: Converters.wattsToKw
}, {
    id: 'Export_Power',
    mapping: 'Power.Power.Export_Power',
    type: SensorType.Power,
    textElementId: 'power_grid_text',
    inverse: 'givtcp_import_power',
    converter: Converters.wattsToKw
}, {
    id: 'PV_Power',
    mapping: 'Power.Power.PV_Power',
    type: SensorType.Power,
    textElementId: 'power_solar_text',
    converter: Converters.wattsToKw
}, {
    id: 'Charge_Power',
    mapping: 'Power.Power.Charge_Power',
    type: SensorType.Power,
    textElementId: 'power_battery_text',
    inverse: 'givtcp_discharge_power',
    converter: Converters.wattsToKw
}, {
    id: 'Discharge_Power',
    mapping: 'Power.Power.Discharge_Power',
    type: SensorType.Power,
    textElementId: 'power_battery_text',
    inverse: 'givtcp_charge_power',
    converter: Converters.wattsToKw
}, {
    id: 'Grid_to_Battery',
    mapping: 'Power.Flows.Grid_to_Battery',
    type: SensorType.Flow,
    flowElementId: 'battery_with_grid',
    forceRefresh: true
}, {
    id: 'Grid_to_House',
    mapping: 'Power.Flows.Grid_to_House',
    type: SensorType.Flow,
    flowElementId: 'grid_to_home',
    nonZeroValueCheck: 'givtcp_import_power',
    forceRefresh: true
}, {
    id: 'Solar_to_Battery',
    mapping: 'Power.Flows.Solar_to_Battery',
    type: SensorType.Flow,
    flowElementId: 'solar_to_battery',
    forceRefresh: true
}, {
    id: 'Solar_to_Grid',
    mapping: 'Power.Flows.Solar_to_Grid',
    type: SensorType.Flow,
    flowElementId: 'solar_to_grid',
    forceRefresh: true
}, {
    id: 'Solar_to_House',
    mapping: 'Power.Flows.Solar_to_House',
    type: SensorType.Flow,
    flowElementId: 'solar_to_home',
    forceRefresh: true
}, {
    id: 'Battery_to_Grid',
    mapping: 'Power.Flows.Battery_to_Grid',
    type: SensorType.Flow,
    flowElementId: 'battery_with_grid',
    forceRefresh: true
}, {
    id: 'Battery_to_House',
    mapping: 'Power.Flows.Battery_to_House',
    type: SensorType.Flow,
    flowElementId: 'battery_to_home',
    forceRefresh: true
}, {
    id: 'Load_Energy_Today_kWh',
    mapping: 'Energy.Today.Load_Energy_Today_kWh',
    textElementId: 'energy_home_text',
    type: SensorType.Summary,
    suffix: Suffix.Energy,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true
}, {
    id: 'PV_Energy_Today_kWh',
    mapping: 'Energy.Today.PV_Energy_Today_kWh',
    textElementId: 'energy_solar_text',
    type: SensorType.Summary,
    suffix: Suffix.Energy,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true
}, {
    id: 'daily_energy_peak',
    mapping: 'Energy.Rates.day_energy',
    textElementId: 'energy_imported_peak_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true
}, {
    id: 'daily_energy_offpeak',
    mapping: 'Energy.Rates.night_energy',
    textElementId: 'energy_imported_offpeak_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true
}, {
    id: 'Export_Energy_Today_kWh',
    mapping: 'Energy.Today.Export_Energy_Today_kWh',
    textElementId: 'energy_exported_text',
    type: SensorType.Summary,
    formatter: Formatters.roundToOneDecimalPlace,
    forceRefresh: true
}, {
    id: 'Battery_State',
    textElementId: 'battery_state_text',
    type: SensorType.Summary
}, {
    id: 'Battery_State_of_Charge',
    mapping: 'Power.Power.SOC',
    textElementId: 'battery_percentage_text',
    type: SensorType.Summary,
    suffix: Suffix.Percent
}, {
    id: 'daily_energy_cost_peak',
    mapping: 'Energy.Rates.day_cost',
    textElementId: 'energy_imported_peak_cost_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true
}, {
    id: 'daily_energy_cost_offpeak',
    mapping: 'Energy.Rates.night_cost',
    textElementId: 'energy_imported_offpeak_cost_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true
}, {
    id: 'Export_Income',
    mapping: 'Energy.Today.Export_Energy_Today_kWh',
    textElementId: 'energy_exported_income',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true
}, {
    id: 'Solar_Income',
    mapping: 'Energy.Today.PV_Energy_Today_kWh',
    textElementId: 'solar_generated_income_text',
    type: SensorType.Summary,
    prefix: Prefix.Currency,
    converter: Converters.numberToCurrency,
    forceRefresh: true
}, {
    id: 'Inverter_Temperature',
    mapping: 'Inverter_Details.Inverter_Temperature',
    textElementId: 'inverter_temperature',
    type: SensorType.Summary,
    suffix: Suffix.Temperature,
    formatter: Formatters.roundToOneDecimalPlace
}, {
    id: 'Power_Reserve',
    mapping: 'Control.Battery_Power_Reserve',
    textElementId: 'power_reserve',
    type: SensorType.Summary,
    suffix: Suffix.Percent
}, {
    id: 'Grid_Voltage',
    mapping: 'raw.inverter.v_ac1',
    textElementId: 'grid_voltage',
    type: SensorType.Summary,
    suffix: Suffix.Voltage,
    formatter: Formatters.roundToOneDecimalPlace
}, {
    id: 'Grid_Frequency',
    mapping: 'raw.inverter.f_ac1',
    textElementId: 'grid_frequency',
    type: SensorType.Summary,
    suffix: Suffix.Frequency,
    formatter: Formatters.roundToOneDecimalPlace
}, {
    id: 'Battery_Statistics',
    mapping: 'Battery_Details',
    type: SensorType.Summary
}];

export { Sensors };