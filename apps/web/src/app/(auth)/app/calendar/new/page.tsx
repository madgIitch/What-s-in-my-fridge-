import { redirect } from "next/navigation";

export default function NewMealPage() { redirect("/app/calendar?new=1"); }
