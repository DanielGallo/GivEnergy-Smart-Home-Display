const SensorType = {
    Flow: 'Flow',
    Power: 'Power',
    Summary: 'Summary'
};

const Prefix = {
    Currency: '£',
    CurrencyApprox: '~£',
    CurrencyPositive: '+£',
    CurrencyNegative: '–£'
};

const Suffix = {
    Energy: ' kWh',
    Frequency: ' Hz',
    Percent: '%',
    Power: ' kW',
    Temperature: '°C',
    Voltage: ' V'
};

const CombinatorType = {
    All: 'All',
    Any: 'Any',
    Addition: 'Addition',
    Average: 'Average',
    EarliestDate: 'EarliestDate',
    Ignore: 'Ignore'
}

export { SensorType, Prefix, Suffix, CombinatorType };