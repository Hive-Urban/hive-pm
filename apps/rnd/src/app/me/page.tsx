import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// /me — resolves the current logged-in user to their R&D member row
// (matching by email) and redirects to their /team/[handle] profile.
export default async function MePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login");

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("rnd_members")
    .select("handle")
    .eq("email", email)
    .maybeSingle();

  if (member?.handle) {
    redirect(`/team/${encodeURIComponent(member.handle)}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <p className="text-xs font-semibold tracking-widest text-indigo-500 mb-2">HIVE · R&amp;D</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">No member profile found</h1>
      <p className="text-sm text-gray-600 mb-6">
        We couldn&apos;t find an R&amp;D member with the email <code className="bg-gray-100 px-1 rounded">{email}</code>.
      </p>
      <p className="text-sm text-gray-500">
        Ask an admin to add you in <Link href="/admin" className="text-indigo-600 underline">/admin → Members</Link>.
      </p>
    </div>
  );
}
