import Workspace from "@/components/Workspace";

/** A saved analysis, shown as it ran. */
export default async function SavedRunPage({ params }: { params: Promise<{ id: string }> }) {
  return <Workspace runId={(await params).id} />;
}
