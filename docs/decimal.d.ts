export default class Decimal {
    constructor(value: number | string | Decimal);
    plus(value: number | string | Decimal): Decimal;
    minus(value: number | string | Decimal): Decimal;
    times(value: number | string | Decimal): Decimal;
    dividedBy(value: number | string | Decimal): Decimal;
    floor(): Decimal;
    ceil(): Decimal;
    toNumber(): number;
    toString(): string;
    lte(value: number | string | Decimal): boolean;
    gte(value: number | string | Decimal): boolean;
    gt(value: number | string | Decimal): boolean;
    lt(value: number | string | Decimal): boolean;
    static min(...values: (number | string | Decimal)[]): Decimal;
    static max(...values: (number | string | Decimal)[]): Decimal;
}
