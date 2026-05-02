import { redirect } from "next/navigation";
import { getSession } from "@/src/server/auth/session";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
