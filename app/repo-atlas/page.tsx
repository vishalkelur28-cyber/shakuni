import PageHeader from "../../components/PageHeader";
import RepoAtlas from "../../components/RepoAtlas";

export default function RepoAtlasPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Repo Atlas"
        description="Learn the crypto and smart-contract basics, then add up to 30 repositories and map how they connect, in plain and technical English. Pre-loaded with the Circle scope as a worked example."
      />
      <div className="mt-8">
        <RepoAtlas />
      </div>
    </div>
  );
}
