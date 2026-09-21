export type MealType="breakfast"|"lunch"|"dinner"|"snack";
export interface MealIngredient {inventory_item_id:string|null;ingredient_key:string|null;name:string;quantity:number|null;unit:string|null;mutation_id:string|null}
export interface MealSnapshot {version:1;recipe_id:string;title:string;ingredients:Array<{ingredient_key:string|null;name:string;quantity:number|null;unit:string|null}>;instructions:string[]}
export interface MealPayload {meal_type:MealType;meal_date:string;recipe_id:string|null;recipe_snapshot:MealSnapshot|null;custom_name:string|null;ingredients_consumed:MealIngredient[];notes:string|null;calories_estimate:number|null;consumed_at:string|null}
export interface MealEntry extends MealPayload {id:string;user_id:string;version:number;created_at:string;updated_at:string;deleted_at:string|null}
export interface MealConflict {entity_id:string;expected_version:number|null;current:MealEntry|null}
export interface MealEnvelope {client_mutation_id:string;status:"applied"|"duplicate"|"conflict"|"rejected";code:string;result:MealEntry|null;conflicts:MealConflict[]}
export interface MealMutation {clientMutationId:string;userId:string;operation:"create"|"update"|"delete";mealEntryId:string;expectedVersion:number|null;payload:MealPayload|null;state:"pending"|"sending"|"uncertain"|"conflict"|"rejected";createdAt:string;result?:MealEntry|null;conflicts?:MealConflict[]}
