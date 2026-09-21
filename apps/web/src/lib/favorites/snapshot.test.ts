import {describe,expect,it} from "vitest";
import {snapshotFromRecipe} from "./snapshot";
describe("recipe snapshot",()=>{
 it("freezes title, ingredients and instructions in version one",()=>{const source={name:"Tortilla",ingredientsWithMeasures:["2 ud huevo","sal"],instructions:"Batir\nCocinar"};const snapshot=snapshotFromRecipe(source);source.name="Otro";expect(snapshot).toEqual({version:1,title:"Tortilla",ingredients:[{ingredientKey:"huevo",name:"huevo",quantity:2,unit:"ud"},{ingredientKey:"sal",name:"sal",quantity:null,unit:null}],instructions:["Batir","Cocinar"]})});
});

