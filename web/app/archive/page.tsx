import SearchableArchive from "@/components/SearchableArchive";
import { SectionHeading } from "@/components/ui";
import { getAllBriefs } from "@/lib/queries";

export const revalidate = 300;

export default async function ArchivePage() {
  const briefs = await getAllBriefs();

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Archive"
        subtitle="Every brief, searchable by term and filterable by date."
      />
      <SearchableArchive briefs={briefs} />
    </div>
  );
}
