import type { ArchiveEntry } from "../types";

export function Archive({ entries }: { entries: ArchiveEntry[] }) {
  return (
    <ol className="archive">
      {entries.map((entry) => (
        <li key={entry.id}>
          <time>{entry.time}</time>
          <span className="archive-event">{entry.event}</span>
          <p>{entry.detail}</p>
        </li>
      ))}
    </ol>
  );
}
