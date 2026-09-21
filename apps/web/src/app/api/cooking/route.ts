import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request:NextRequest){const s=await createServerSupabaseClient();const {data:{user}}=await s.auth.getUser();if(!user)return Response.json({code:"UNAUTHENTICATED"},{status:401});const body=await request.json();const {data,error}=await s.rpc("apply_cooking_mutation",{p_client_mutation_id:body.client_mutation_id,p_recipe_snapshot:body.recipe_snapshot,p_lines:body.lines});return error?Response.json({code:"SERVER_ERROR"},{status:500}):Response.json(data)}
