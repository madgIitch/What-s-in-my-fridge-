import {describe,expect,it} from "vitest";
import {aggregateLines,deriveMissing} from "./derive";
describe("shopping derivation",()=>{
 it("recalculates missing without mutating the snapshot",()=>{const source=[{ingredientKey:"arroz",name:"Arroz",quantity:3,unit:"g"}];expect(deriveMissing(source,[{name:"arroz",normalizedName:"arroz",quantity:1,unit:"g"}])[0].quantity).toBe(2);expect(source[0].quantity).toBe(3)});
 it("aggregates only matching ingredient and unit",()=>{const lines=[{ingredientKey:"x",name:"X",quantity:1,unit:"g",source:"derived" as const},{ingredientKey:"x",name:"X",quantity:2,unit:"g",source:"explicit" as const},{ingredientKey:"x",name:"X",quantity:1,unit:"kg",source:"explicit" as const}];expect(aggregateLines(lines)).toHaveLength(2);expect(aggregateLines(lines)[0].quantity).toBe(3)});
});

