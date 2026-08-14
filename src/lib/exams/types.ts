import type { Exercise } from "../lessons/types";
import type { LevelSlug } from "../courses";

/** One thematic block of an exam (e.g. "Alfabeto y pronunciación"), scored
 * and reported separately so a student sees which skill areas are solid
 * and which need review — not just one aggregate percentage. */
export interface ExamSkillArea {
  id: string;
  title: string;
  exercises: Exercise[];
}

export interface ExamContent {
  slug: string;
  level: LevelSlug;
  title: string;
  /** Short label describing which lessons this exam covers, e.g. "Lecciones 1-10". */
  lessonRangeLabel: string;
  skillAreas: ExamSkillArea[];
}
