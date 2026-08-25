import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import StoryEditor from "@/components/admin/StoryEditor";

export default async function NewStoryPage({
  params,
}: PageProps<"/[lang]/admin/stories/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <StoryEditor
      lang={lang}
      dict={dict.admin.stories}
      story={{
        id: null,
        title: "",
        author: "",
        level: "A1",
        text: "",
        description: "",
        translationEs: "",
        audioUrl: "",
        isPremium: false,
        premiumOnly: false,
      }}
    />
  );
}
