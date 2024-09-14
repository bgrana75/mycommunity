import { Asset } from "@hiveio/dhive";

export function extractNumber(value: string): number {

    const match = value.match(/([\d.]+)/);
    return match ? parseFloat(match[0]) : 0;
}