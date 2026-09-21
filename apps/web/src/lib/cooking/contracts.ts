import type { RecipeSnapshot } from "../favorites/types";
export interface CookingLine { ingredient_key:string; inventory_item_id:string; expected_version:number; quantity:number; unit:string }
export interface CookingRequest { client_mutation_id:string; recipe_snapshot:RecipeSnapshot; lines:CookingLine[] }

