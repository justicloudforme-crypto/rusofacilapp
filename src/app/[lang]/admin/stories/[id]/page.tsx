import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { isStoryLevel } from "@/lib/stories";
import StoryEditor from "@/components/admin/StoryEditor";

export default async function EditStoryPage({
  params,
  searchParams,
}: PageProps<"/[lang]/admin/stories/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const story = await db.story.findUnique({ where: { id } });
  if (!story) notFound();

  const query = await searchParams;

  return (
    <StoryEditor
      lang={lang}
      dict={dict.admin.stories}
      story={{
        id: story.id,
        title: story.title,
        author: story.author,
        level: isStoryLevel(story.level) ? story.level : "A1",
        text: story.text,
        description: story.description ?? "",
        translationEs: story.translationEs ?? "",
        audioUrl: story.audioUrl ?? "",
        isPremium: story.isPremium,
        premiumOnly: story.premiumOnly,
      }}
      initialSavedNotice={query.created === "1"}
    />
  );
}
