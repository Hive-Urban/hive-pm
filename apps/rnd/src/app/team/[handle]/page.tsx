import { supabaseAdmin } from "@/lib/supabase";
import MemberDetail from "@/components/MemberDetail";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle).replace(/^@/, "");

  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("rnd_members")
    .select(`
      *,
      rnd_member_skills (skill_id, level, notes),
      rnd_member_repos (repo_id, role, started_at, ended_at)
    `)
    .eq("handle", handle)
    .maybeSingle();

  // Resolve the viewer's own member row to determine ownership + admin
  // status. Anyone who isn't an admin and isn't viewing themselves gets a
  // read-only profile (no Save, no level pickers, no inline-add buttons).
  let viewerIsAdmin = false;
  let isOwnProfile = false;
  if (viewerEmail) {
    const { data: viewer } = await db
      .from("rnd_members")
      .select("id, email, is_admin")
      .eq("email", viewerEmail)
      .maybeSingle();
    viewerIsAdmin = !!viewer?.is_admin;
    isOwnProfile = !!member && viewer?.id === member.id;
  }
  const canEdit = viewerIsAdmin || isOwnProfile;

  if (!member) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-gray-500 mb-2">Member <code>@{handle}</code> not found.</p>
        <Link href="/team" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          ← Back to team
        </Link>
      </div>
    );
  }

  // Non-admin viewers can only land on their own profile. Direct links to
  // someone else's profile redirect-style fall back to a polite block.
  if (!canEdit && !viewerIsAdmin && !isOwnProfile) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-gray-500 mb-2">
          You can only view your own profile in detail.
        </p>
        <Link href="/team" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          ← Back to the team page
        </Link>
        <p className="text-xs text-gray-400 mt-4">
          Or visit your own profile: <Link href="/me" className="underline">/me</Link>
        </p>
      </div>
    );
  }

  const [{ data: skills }, { data: categories }, { data: repos }] = await Promise.all([
    db.from("rnd_skills").select("id, name, category_id, order_index").order("order_index"),
    db.from("rnd_skill_categories").select("id, name, order_index, color").order("order_index"),
    db.from("rnd_repos").select("id, name, slug, color, status, order_index").order("order_index"),
  ]);

  return (
    <MemberDetail
      member={member}
      skills={skills ?? []}
      categories={categories ?? []}
      repos={repos ?? []}
      canEdit={canEdit}
    />
  );
}
