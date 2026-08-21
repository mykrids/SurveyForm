import SurveyRenderer from "@/components/SurveyRenderer";
export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveyRenderer surveyId={id} />;
}
