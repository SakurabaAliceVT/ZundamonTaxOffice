export default function getCalculator(taxName: string): Promise<(v: number) => number> {
    return import(`./drivers/${taxName}/index.js`).then(module => module.default as (v: number) => number);
}
