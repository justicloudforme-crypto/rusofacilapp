import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetWordAudioAnswersForTests } from "./src/lib/word-audio-answers";

afterEach(cleanup);
// Ответы `/api/word-audio` живут в памяти модуля (долг 172, 7.285): без
// сброса тест видел бы ответ, подставленный соседним тестом.
afterEach(resetWordAudioAnswersForTests);
