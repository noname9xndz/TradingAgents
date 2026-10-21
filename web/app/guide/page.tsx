import { cookies } from "next/headers";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GUIDES, type Block } from "@/lib/guide";
import { LANG_COOKIE, toLang } from "@/lib/lang";
import { RATING_STYLE } from "@/lib/shared";

function Render({ block }: { block: Block }) {
  if ("md" in block)
    return (
      <div className="report">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.md}</ReactMarkdown>
      </div>
    );
  if ("ratings" in block)
    return (
      <table className="w-full text-sm">
        <tbody>
          {block.ratings.map(([rating, meaning]) => (
            <tr key={rating} className="border-t border-slate-800">
              <td className="w-36 py-2">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${RATING_STYLE[rating] ?? "bg-slate-600"}`}>
                  {rating}
                </span>
              </td>
              <td className="py-2">{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-400 uppercase">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row[0]} className="border-t border-slate-800 align-top">
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-3 ${i === 0 ? "font-semibold text-slate-100" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GuidePage() {
  const guide = GUIDES[toLang((await cookies()).get(LANG_COOKIE)?.value)];
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <h1 className="text-xl font-semibold text-slate-100">{guide.title}</h1>

      <nav className="flex flex-wrap gap-2 text-sm">
        {guide.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:bg-slate-800">
            {s.nav}
          </a>
        ))}
      </nav>

      {guide.sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-6 space-y-3 rounded-md border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-slate-100">{s.title}</h2>
          <div className="space-y-2 text-sm leading-6 text-slate-300">
            {s.blocks.map((block, i) => (
              <Render key={i} block={block} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-500">{guide.disclaimer}</p>
    </main>
  );
}
