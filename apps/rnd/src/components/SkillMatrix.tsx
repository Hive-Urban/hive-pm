"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

type Member = {
  id: string;
  handle: string;
  full_name: string;
  role: string | null;
  rnd_member_skills?: Array<{ skill_id: string; level: number }>;
};
type Skill = { id: string; name: string; category_id: string | null; order_index: number };
type Category = { id: string; name: string; order_index: number; color: string | null };

const LEVEL_BG: Record<number, string> = {
  0: "bg-gray-50 border-gray-100",
  1: "bg-indigo-50 border-indigo-100 text-indigo-500",
  2: "bg-indigo-100 border-indigo-200 text-indigo-700",
  3: "bg-indigo-300 border-indigo-400 text-white",
  4: "bg-indigo-500 border-indigo-600 text-white",
  5: "bg-violet-700 border-violet-800 text-white",
};

export default function SkillMatrix({ members, skills, categories }: {
  members: Member[];
  skills: Skill[];
  categories: Category[];
}) {
  const [minLevel, setMinLevel] = useState(0);
  const [hideEmptySkills, setHideEmptySkills] = useState(false);

  // Pre-compute level lookup: members[].rnd_member_skills[].level by skill_id.
  const memberSkillLevel = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const member of members) {
      const inner = new Map<string, number>();
      for (const ms of member.rnd_member_skills ?? []) inner.set(ms.skill_id, ms.level);
      m.set(member.id, inner);
    }
    return m;
  }, [members]);

  // Skills grouped by category for display, optionally filtering out skills
  // nobody has at minLevel or above.
  const visibleSkills = useMemo(() => {
    return skills.filter(s => {
      if (!hideEmptySkills && minLevel === 0) return true;
      let max = 0;
      for (const member of members) {
        const lvl = memberSkillLevel.get(member.id)?.get(s.id) ?? 0;
        if (lvl > max) max = lvl;
      }
      if (hideEmptySkills && max === 0) return false;
      if (minLevel > 0 && max < minLevel) return false;
      return true;
    });
  }, [skills, members, memberSkillLevel, hideEmptySkills, minLevel]);

  const skillsByCategory = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of visibleSkills) {
      const key = s.category_id ?? "_uncat";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [visibleSkills]);

  if (members.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center text-sm text-gray-500">
        No active members. Add some via the <Link href="/admin" className="text-indigo-600 underline">Admin page</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Min level:</span>
          {[0, 1, 2, 3, 4, 5].map(l => (
            <button key={l}
              onClick={() => setMinLevel(l)}
              className={clsx(
                "w-6 h-6 rounded transition-colors tabular-nums",
                minLevel === l ? "bg-indigo-600 text-white font-semibold" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}>
              {l === 0 ? "all" : l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
          <input type="checkbox" checked={hideEmptySkills} onChange={e => setHideEmptySkills(e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
          Hide skills nobody has
        </label>
        <span className="ml-auto text-gray-400">
          {members.length} members · {visibleSkills.length}/{skills.length} skills shown
        </span>
      </div>

      {/* Matrix */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            {/* Category row */}
            <tr>
              <th className="bg-gray-50 sticky left-0 z-10 px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider min-w-[160px]">
                Member
              </th>
              {categories.map(cat => {
                const inCat = skillsByCategory.get(cat.id) ?? [];
                if (inCat.length === 0) return null;
                return (
                  <th key={cat.id} colSpan={inCat.length}
                    className="bg-gray-50 px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200">
                    <span className="inline-flex items-center gap-1.5">
                      {cat.color && <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }} />}
                      {cat.name}
                    </span>
                  </th>
                );
              })}
            </tr>
            {/* Skill names row */}
            <tr>
              <th className="bg-gray-50 sticky left-0 z-10 px-4 py-2 border-t border-gray-200" />
              {categories.flatMap(cat => {
                const inCat = skillsByCategory.get(cat.id) ?? [];
                return inCat.map((s, i) => (
                  <th key={s.id}
                    className={clsx(
                      "bg-gray-50 px-1 py-2 border-t border-gray-200 text-[10px] font-medium text-gray-600 align-bottom",
                      i === 0 && "border-l border-gray-200"
                    )}
                    style={{ writingMode: "vertical-rl", minHeight: "120px" }}>
                    <div className="rotate-180 whitespace-nowrap">{s.name}</div>
                  </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-t border-gray-200">
                <th className="bg-white sticky left-0 z-10 px-4 py-2 text-left font-medium text-gray-800 border-r border-gray-100">
                  <Link href={`/team/${encodeURIComponent(member.handle)}`}
                    className="hover:text-indigo-700">
                    @{member.handle}
                  </Link>
                  {member.role && <div className="text-[10px] text-gray-400 font-normal">{member.role}</div>}
                </th>
                {categories.flatMap(cat => {
                  const inCat = skillsByCategory.get(cat.id) ?? [];
                  return inCat.map((s, i) => {
                    const level = memberSkillLevel.get(member.id)?.get(s.id) ?? 0;
                    return (
                      <td key={s.id}
                        className={clsx(
                          "p-0 border-l border-gray-50",
                          i === 0 && "border-l border-gray-200"
                        )}>
                        <div className={clsx(
                          "w-9 h-9 flex items-center justify-center text-[11px] font-semibold tabular-nums border-l border-t",
                          LEVEL_BG[level] ?? LEVEL_BG[0]
                        )}
                          title={`${member.full_name} · ${s.name} · level ${level}`}>
                          {level === 0 ? "" : level}
                        </div>
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span>Level legend:</span>
        {[1, 2, 3, 4, 5].map(l => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className={clsx("w-4 h-4 rounded border", LEVEL_BG[l])} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
