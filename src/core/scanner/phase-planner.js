const PHASE_MAP = {
    factory: 1,
    service: 1,
    filter: 2,
    directive: 3,
    component: 3,
    controller: 4,
    template: 5,
    routing: 6,
    module: 6,
    unknown: 4,
};

 
export const PHASE_NAMES = [
    "",
    "Services & Factories",
    "Filters → Pipes",
    "Directives & Components",
    "Controllers",
    "Templates",
    "Roteamento & Módulos",
];

 
export function getMigrationPhase(type) {
    return PHASE_MAP[type] !== undefined ? PHASE_MAP[type] : 4;
}

 
export function estimateHours(complexity, loc) {
    const base =
        complexity === "alta" ? 3.5 : complexity === "média" ? 1.5 : 0.5;
    const locFactor = Math.max(1, loc / 100);
    return Math.round(base * locFactor * 10) / 10;
}
