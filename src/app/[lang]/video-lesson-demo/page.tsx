import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { sampleLesson } from "@/lib/video-lesson/sampleLesson";
import VideoLessonCard from "@/components/video-lesson/VideoLessonCard";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/video-lesson-demo">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/video-lesson-demo") };
}

export default async function VideoLessonDemoPage({ params }: PageProps<"/[lang]/video-lesson-demo">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <VideoLessonCard lesson={sampleLesson} />;
}
